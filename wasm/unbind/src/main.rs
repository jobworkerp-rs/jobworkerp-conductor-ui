//! `wasm-unbind <input> <output>`: makes a module built for
//! wasm32-unknown-unknown loadable without imports.
//!
//! chrono turns on its JavaScript Date support on that target and nothing can
//! turn it off, so the cron module carries wasm-bindgen's exports and
//! imports, which only wasm-bindgen's CLI and JavaScript glue would satisfy.
//! No function the screens call reaches them, so this
//! 1. removes the exports named `__*` (wasm-bindgen's and the toolchain's;
//!    `wasm_abi` reserves the prefix) and everything only they reached,
//! 2. replaces the imports still referenced from the function table with
//!    bodies that trap, so reaching one fails loudly instead of at load time.

use std::process::ExitCode;

fn unbind(input: &str, output: &str) -> Result<Vec<String>, String> {
    let mut module = walrus::Module::from_file(input).map_err(|err| format!("{input}: {err}"))?;
    let internal: Vec<_> = module
        .exports
        .iter()
        .filter(|export| export.name.starts_with("__"))
        .map(|export| export.id())
        .collect();
    for id in internal {
        module.exports.delete(id);
    }
    walrus::passes::gc::run(&mut module);

    let mut trapped = Vec::new();
    let imports: Vec<_> = module
        .imports
        .iter()
        .map(|import| {
            (
                format!("{}.{}", import.module, import.name),
                import.kind.clone(),
            )
        })
        .collect();
    for (name, kind) in imports {
        let walrus::ImportKind::Function(function) = kind else {
            return Err(format!("{input} imports {name}, which is not a function"));
        };
        module
            .replace_imported_func(function, |(body, _)| {
                body.unreachable();
            })
            .map_err(|err| format!("{name}: {err}"))?;
        trapped.push(name);
    }
    module
        .emit_wasm_file(output)
        .map_err(|err| format!("{output}: {err}"))?;
    Ok(trapped)
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let [input, output] = args.as_slice() else {
        eprintln!("usage: wasm-unbind <input> <output>");
        return ExitCode::from(2);
    };
    match unbind(input, output) {
        Ok(trapped) => {
            for name in trapped {
                eprintln!("wasm-unbind: {input}: {name} now traps");
            }
            ExitCode::SUCCESS
        }
        Err(message) => {
            eprintln!("wasm-unbind: {message}");
            ExitCode::FAILURE
        }
    }
}
