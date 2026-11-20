//! The plain C ABI the browser modules share (no bindings generator): the
//! host copies UTF-8 strings into memory obtained from `alloc`, calls an
//! exported function, and on failure (-1) reads the message at
//! `last_error_ptr` (`last_error_len` bytes).
//!
//! Exports named `__*` are reserved: wasm-unbind removes them with
//! wasm-bindgen's leftovers, so a module's own functions must not use them.

use std::cell::RefCell;

thread_local! {
    static LAST_ERROR: RefCell<String> = const { RefCell::new(String::new()) };
}

/// The value exported functions return on failure, with the message stored.
pub const FAILED: i32 = -1;

/// Stores `message` for `last_error_ptr` and returns `FAILED`.
pub fn fail(message: impl Into<String>) -> i32 {
    LAST_ERROR.with(|last| *last.borrow_mut() = message.into());
    FAILED
}

/// 0 on success; otherwise `FAILED` with the message stored.
pub fn status(result: Result<(), String>) -> i32 {
    result.map_or_else(fail, |()| 0)
}

/// # Safety
/// `ptr` must point to `len` bytes written by the host into memory from
/// `alloc`. Fails when they are not UTF-8.
pub unsafe fn read(ptr: *const u8, len: usize) -> Result<&'static str, String> {
    // SAFETY: the caller hands over a buffer it obtained from `alloc`.
    let bytes = unsafe { std::slice::from_raw_parts(ptr, len) };
    std::str::from_utf8(bytes).map_err(|_| "argument is not valid UTF-8".to_string())
}

/// What `export_abi!` exports; not for the modules' own code.
#[doc(hidden)]
pub mod __private {
    use std::alloc::Layout;
    use std::ptr::NonNull;

    use super::LAST_ERROR;

    // The layout is rebuilt from `len` on release; going through the
    // allocator directly keeps it exactly the one used to allocate, which a
    // Vec's capacity does not promise.
    fn layout(len: usize) -> Layout {
        Layout::array::<u8>(len).expect("buffer length fits the address space")
    }

    pub fn alloc(len: usize) -> *mut u8 {
        if len == 0 {
            return NonNull::dangling().as_ptr();
        }
        let layout = layout(len);
        // SAFETY: the layout has a non-zero size.
        let ptr = unsafe { std::alloc::alloc(layout) };
        if ptr.is_null() {
            std::alloc::handle_alloc_error(layout);
        }
        ptr
    }

    /// # Safety
    /// `ptr` and `len` must come from a matching `alloc` call.
    pub unsafe fn dealloc(ptr: *mut u8, len: usize) {
        if len != 0 {
            // SAFETY: `alloc` returned `ptr` for this same layout.
            unsafe { std::alloc::dealloc(ptr, layout(len)) }
        }
    }

    pub fn last_error_ptr() -> *const u8 {
        LAST_ERROR.with(|last| last.borrow().as_ptr())
    }

    pub fn last_error_len() -> usize {
        LAST_ERROR.with(|last| last.borrow().len())
    }
}

/// Exports `alloc`, `dealloc`, `last_error_ptr` and `last_error_len` from
/// the calling crate; symbols are only exported from the cdylib itself, not
/// its dependencies.
#[macro_export]
macro_rules! export_abi {
    () => {
        #[unsafe(no_mangle)]
        pub extern "C" fn alloc(len: usize) -> *mut u8 {
            $crate::__private::alloc(len)
        }

        /// # Safety
        /// `ptr` and `len` must come from a matching `alloc` call.
        #[unsafe(no_mangle)]
        pub unsafe extern "C" fn dealloc(ptr: *mut u8, len: usize) {
            unsafe { $crate::__private::dealloc(ptr, len) }
        }

        #[unsafe(no_mangle)]
        pub extern "C" fn last_error_ptr() -> *const u8 {
            $crate::__private::last_error_ptr()
        }

        #[unsafe(no_mangle)]
        pub extern "C" fn last_error_len() -> usize {
            $crate::__private::last_error_len()
        }
    };
}

#[cfg(test)]
mod tests {
    use super::__private::{alloc, dealloc};
    use super::*;

    #[test]
    fn allocates_writable_buffers_of_any_length_and_releases_them() {
        for len in [0, 1, 7, 4096, 1 << 20] {
            let ptr = alloc(len);
            assert!(!ptr.is_null());
            // SAFETY: `alloc` returned `len` writable bytes.
            unsafe {
                std::ptr::write_bytes(ptr, 0xab, len);
                dealloc(ptr, len);
            }
        }
    }

    #[test]
    fn reads_utf8_and_refuses_other_bytes() {
        let text = "日本語";
        // SAFETY: points at the bytes of a live string.
        assert_eq!(unsafe { read(text.as_ptr(), text.len()) }, Ok(text));
        let bytes = [0xff, 0xfe];
        // SAFETY: points at a live array.
        assert!(unsafe { read(bytes.as_ptr(), bytes.len()) }.is_err());
    }

    #[test]
    fn keeps_the_last_error_and_reports_status() {
        assert_eq!(status(Ok(())), 0);
        assert_eq!(status(Err("first".into())), FAILED);
        assert_eq!(fail("second"), FAILED);
        let (ptr, len) = (__private::last_error_ptr(), __private::last_error_len());
        // SAFETY: the stored message is alive until the next failure.
        let message = unsafe { std::slice::from_raw_parts(ptr, len) };
        assert_eq!(message, b"second");
    }
}
