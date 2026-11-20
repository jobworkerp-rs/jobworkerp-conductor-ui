//! conductor's Slack handler regex rules for the browser, over the plain C
//! ABI of `wasm_abi`.

use std::cell::RefCell;

use regex::{Regex, RegexBuilder};
use wasm_abi::{fail, read, status};

wasm_abi::export_abi!();

/// The size limit conductor compiles patterns with when it validates them.
const SIZE_LIMIT: usize = 10 * 1024 * 1024;

thread_local! {
    // The UI checks and tries the same pattern on every keystroke; keep the
    // last compilation instead of building it again.
    static LAST_COMPILED: RefCell<Option<(String, Result<Regex, String>)>> =
        const { RefCell::new(None) };
}

fn compiled<T>(pattern: &str, use_it: impl FnOnce(&Result<Regex, String>) -> T) -> T {
    LAST_COMPILED.with(|last| {
        let mut last = last.borrow_mut();
        if last.as_ref().is_none_or(|(cached, _)| cached != pattern) {
            let result = RegexBuilder::new(pattern)
                .size_limit(SIZE_LIMIT)
                .build()
                .map_err(|err| err.to_string());
            *last = Some((pattern.to_string(), result));
        }
        use_it(&last.as_ref().expect("filled above").1)
    })
}

/// 0 when the pattern compiles; otherwise -1 with the compiler's message.
///
/// # Safety
/// See `wasm_abi::read`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn check(ptr: *const u8, len: usize) -> i32 {
    status(unsafe { read(ptr, len) }.and_then(|pattern| {
        compiled(pattern, |result| {
            result.as_ref().map(drop).map_err(Clone::clone)
        })
    }))
}

/// 1 when `text` matches, 0 when it does not, -1 when the pattern is invalid.
///
/// # Safety
/// See `wasm_abi::read`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn is_match(
    pattern_ptr: *const u8,
    pattern_len: usize,
    text_ptr: *const u8,
    text_len: usize,
) -> i32 {
    let (pattern, text) = match (unsafe { read(pattern_ptr, pattern_len) }, unsafe {
        read(text_ptr, text_len)
    }) {
        (Ok(pattern), Ok(text)) => (pattern, text),
        (Err(message), _) | (_, Err(message)) => return fail(message),
    };
    compiled(pattern, |result| match result {
        Ok(regex) => i32::from(regex.is_match(text)),
        Err(message) => fail(message.clone()),
    })
}
