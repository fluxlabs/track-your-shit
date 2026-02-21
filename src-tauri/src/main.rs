// Control Tower - Main Entry Point
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

// Prevents additional console window on Windows in release
#![cfg_attr(all(not(debug_assertions)), windows_subsystem = "windows")]

fn main() {
    track_your_shit_lib::run()
}
