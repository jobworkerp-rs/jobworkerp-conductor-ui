//! conductor's cron expression rules for the browser, over the plain C ABI of
//! `wasm_abi`. conductor schedules through tokio-cron-scheduler, which parses
//! with croner configured as `parser()` is here.

use std::cell::RefCell;

use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use croner::Cron;
use croner::parser::{CronParser, Seconds};
use wasm_abi::{read, status};

wasm_abi::export_abi!();

/// The most run times one `next_runs` call returns.
const MAX_RUNS: u32 = 64;

thread_local! {
    static RUNS: RefCell<Vec<i64>> = const { RefCell::new(Vec::new()) };
}

/// The parser tokio-cron-scheduler 0.15 builds for every job.
fn parser() -> CronParser {
    CronParser::builder()
        .seconds(Seconds::Required)
        .dom_and_dow(true)
        .build()
}

fn parse(expression: &str) -> Result<Cron, String> {
    parser().parse(expression).map_err(|err| err.to_string())
}

/// 0 when conductor accepts the expression; otherwise -1 with croner's
/// message.
///
/// # Safety
/// See `wasm_abi::read`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn check(ptr: *const u8, len: usize) -> i32 {
    status(unsafe { read(ptr, len) }.and_then(parse).map(drop))
}

fn time_zone(name: &str) -> Result<Tz, String> {
    name.parse()
        .map_err(|_| format!("unknown time zone: {name}"))
}

/// 0 when conductor can read the time zone name (chrono-tz, as conductor
/// parses CONDUCTOR_CRON_TIMEZONE); otherwise -1 with the message.
///
/// # Safety
/// See `wasm_abi::read`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn check_time_zone(ptr: *const u8, len: usize) -> i32 {
    status(unsafe { read(ptr, len) }.and_then(time_zone).map(drop))
}

fn fill_runs(
    expression: &str,
    zone_name: &str,
    after_seconds: i64,
    runs: &mut Vec<i64>,
    count: usize,
) -> Result<(), String> {
    let cron = parse(expression)?;
    let tz = time_zone(zone_name)?;
    let mut from = DateTime::<Utc>::from_timestamp(after_seconds, 0)
        .ok_or_else(|| format!("time out of range: {after_seconds}"))?
        .with_timezone(&tz);
    while runs.len() < count {
        from = cron
            .find_next_occurrence(&from, false)
            .map_err(|err| err.to_string())?;
        runs.push(from.timestamp());
    }
    Ok(())
}

/// The next `count` (at most 64) run times after `after_seconds` (UNIX
/// seconds) in `time_zone`, as i64 UNIX seconds at `runs_ptr`. Returns how
/// many were written, or -1 with the message when the expression or time
/// zone is invalid or no run is found.
///
/// # Safety
/// See `wasm_abi::read`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn next_runs(
    expression_ptr: *const u8,
    expression_len: usize,
    time_zone_ptr: *const u8,
    time_zone_len: usize,
    after_seconds: i64,
    count: u32,
) -> i32 {
    RUNS.with(|runs| {
        let mut runs = runs.borrow_mut();
        runs.clear();
        let result = unsafe { read(expression_ptr, expression_len) }.and_then(|expression| {
            let time_zone = unsafe { read(time_zone_ptr, time_zone_len) }?;
            fill_runs(
                expression,
                time_zone,
                after_seconds,
                &mut runs,
                count.min(MAX_RUNS) as usize,
            )
        });
        match status(result) {
            0 => runs.len() as i32,
            failed => failed,
        }
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn runs_ptr() -> *const i64 {
    RUNS.with(|runs| runs.borrow().as_ptr())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_as_tokio_cron_scheduler_does() {
        assert!(parse("0 0 9 * * MON-FRI").is_ok());
        assert!(parse("0 9 * * *").is_err());
        assert!(parse("@midnight").is_err());
    }

    #[test]
    fn reads_time_zone_names_as_conductor_does() {
        assert!(time_zone("Asia/Tokyo").is_ok());
        assert!(time_zone("asia/tokyo").is_err());
        assert!(time_zone(" Asia/Tokyo").is_err());
    }

    #[test]
    fn fills_runs_after_a_time() {
        let mut runs = Vec::new();
        fill_runs("0 0 9 * * *", "UTC", 0, &mut runs, 2).unwrap();
        assert_eq!(runs, [9 * 3600, 33 * 3600]);
    }
}
