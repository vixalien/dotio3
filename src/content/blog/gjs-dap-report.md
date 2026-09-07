---
title: "Project Final Report: Adding Debug Adapter Protocol Support to GJS"
description: "How to debug a GJS application in Zed using DAP support"
publish_date: 2026-09-07
invert: true
tags: [gnome, debugging, gsoc]
---

Hello again! A few weeks ago, I wrote about the work I've been doing this summer adding Debug Adapter Protocol (DAP) support to GJS as part of Google Summer of Code (GSoC) 2026.
If you haven't read that post, [start there][midterm] for the background on what GJS and DAP are and why this matters.

As my GSoC is wrapping up, I wanted to share you an update on what I've done, what I've learnt, and what I'm planning for the future.

Instead of a lengthy report, I actually want to walk you through debugging a real GJS application using the DAP support I've added to GJS.

By the end of this post, you'll know how to launch a GJS app in Zed, set breakpoints (including on exceptions), step through code, inspect variables and more, all from inside your editor.

## Setting Up

The code I've implemented is currently in a [Merge Request being reviewed][mr], so to you use it, you will need to clone and build GJS from source (until GNOME 52).

### Cloning and Building GJS from source

You can build GJS from source by following the [Hacking guide][hacking], but here's a shorter version of it

```bash
# 1. Clone GJS
git clone https://gitlab.gnome.org/GNOME/gjs.git
cd gjs

# 2. Checkout my branch
git checkout wip/vixalien/dap

# 3. Setup meson
meson setup _build

# 4. Build GJS
ninja -C _build

# 5. Verify
meson devenv -C _build gjs-console ../script.js
```

This will be required before GNOME 52.

> Please note the path where you cloned GJS (e.g. `~/Projects/gjs`). We will need it later.

### Editor setup

You will also need to download and install [the Zed editor][zed]. The currently supported editors for GJS DAP are Zed and VS Code. We will use the Zed editor since it's more validated to work with the GJS DAP support currently.

You will also need to install the [GJS Debugger Extension for Zed][zed-extension], which is currently [pending review to be included in the Zed extension store][zed-extension-pr].

But you can build it locally, by cloning [my Extension][zed-extension]. To install within Zed, Press `Ctrl+Shift+X`, then click "Install Dev Extension". A file picker will open, so navigate to the directory where you cloned the extension and select it.

This will require a Rust toolchain to be installed, so the extension can be built.

Let me know if you want to debug GJS apps from other editors (not just Zed).

## Navigating Around

To make this concrete, I'm going to walk through debugging an standard example application.

### 1. Setting up the application

The application we are going to debug is a [simple Calculator, as found in the GJS Examples][calc]

Create a simple file called `calc.js` in a new project directory and save the contents of the Calculator app above into it.

Then open the project in Zed as you normally would.

![Calc project open in zed](/images/posts/gjs-dap-report/calc.png)

### 2. Opening the Project in the Debugger

To open the project in the Debugger, you can use the `F4` key to start debugging.

A dialog will then pop up asking for the Debugger configuration.

1. Select the `Launch` tab to launch a new debugger instance.
2. Select `GJS` as the debugger.
3. Type `calc.js` as the program to debug.
4. Disable "Stop On Entry" so that the debugger doesn't stop at the first line of the script.
5. Press `Ctrl+Enter` or select "Edit in debug.json" to open the configuration file.

![GJS debugger launch options](/images/posts/gjs-dap-report/debugger-launch.png)

This will create a new configuration file at `.zed/debug.json` in the project directory, we will use this file to configure the debugger and make sure our debugger settings are saved across sessions.

That file will look like this:

```jsonc
// Project-local debug tasks
//
// For more documentation on how to configure debug tasks,
// see: https://zed.dev/docs/debugger
[
  {
    "adapter": "gjs",
    "label": "calc.js (gjs)",
    "args": [],
    "cwd": "/home/alien/Projects/calc",
    "program": "calc.js",
    "stopOnEntry": false,
  },
]
```

We will need to make a small modification to it to point it to the GJS we just compiled (otherwise it will use the default GJS from our system, which doesn't have the unmerged DAP changes).

This is needed before GNOME 52 is released (which means gjs will be able to do this natively).

We will do it by adding a `gjsPath` field to the configuration in this format:

```diff
...
     "program": "calc.js",
     "stopOnEntry": false,
+    "gjsPath": "flatpak-spawn --host meson devenv -C ~/Projects/gjs  --workdir . gjs-console",
   },
 ]
```

Where `~/Projects/gjs` is the path to the GJS repository you cloned.

After making this change, press `F5` again, and now you will see an option called `calc.js (gjs)` in the dialog's "Debug" tab.

![GJS debugger run dialog](/images/posts/gjs-dap-report/debugger-run.png)

Click that configuration, and this will launch the debug configuration we just saved.

Now you have a running GJS debugger session!

![Running debugger](/images/posts/gjs-dap-report/running-debugger.png)

### 3. Navigating the Debugger

At the bottom of the window, you will see a debug toolbar with various sections, panes and controls.

Fret not! The debugger toolbar is simple to understand, as I will explain here below.

![Debugger controls](/images/posts/gjs-dap-report/debugger-controls.png)

The debugger toolbar is made up of controls at the top, then 3 horizontal panes.

#### 1. The controls bar

This is where you have different buttons to control the state of the program. In order, we have the Pause/Resume button, Step Over (or Next) button, Step In, Step Out, then the Restart and Quit buttons.

![Controls bar](/images/posts/gjs-dap-report/controls.png)

#### 2. The frames pane

This pane shows the currently active [stack frames][stack-frames] (or call stacks).

![Frames pane](/images/posts/gjs-dap-report/frames.png)

This frame has another tab that shows the various set breakpoints.

![Breakpoints](/images/posts/gjs-dap-report/breakpoints.png)

#### 3. The console pane

This pane shows the console output of the program and allows you to potentially execute commands (not yet supported in the GJS debugger).

![Console pane](/images/posts/gjs-dap-report/console.png)

It has a different tab that shows the different [scopes][scopes]. Here, you can expand a scope to see variables inside that scope.

![Variables pane](/images/posts/gjs-dap-report/variables.png)

#### 4. The terminal pane

Last, but not least, the terminal pane shows regular terminal output from the running program. This is also not currently implemented in the GJS debugger.

![Terminal pane](/images/posts/gjs-dap-report/terminal.png)

## Debugging

Now that you can navigate around the debugger, let's get to debugging!

### 1. Using the `debugger` statement.

The `debugger` statement is a built-in statement in JavaScript that pauses execution and allows you to inspect the current state of the program at the time it pauses.

You can add a `debugger` statement to `calc.js` at the end of the file to test it out.

![Debugger Statement](/images/posts/gjs-dap-report/debugger-statement.png)

Then click `F5` again to start debugging. This will launch the debugger and pause execution at the `debugger` statement.

> Note: Ignore the "the `debugger` statement is not allowed" message for now, but remember to remove it before building/shipping your application.

The highlighted line is where the debugger paused execution.

![Paused Debugger](/images/posts/gjs-dap-report/paused-debugger.png)

### 2. Inspecting Variables

With the debugger now paused, you can inspect the variables in the current scope.

Click on a scope's name to expand the variables under it.

![Inspecting Variables](/images/posts/gjs-dap-report/inspecting-variables.png)

You can click on one of the objects to inspect its properties, for example, in the `module` scope, click on `Gtk` to see all the widgets available in the GTK library.

![Inspecting Variable Properties](/images/posts/gjs-dap-report/inspecting-variables-properties.png)

Inspecting all types of variables is implemented and you can inspect numbers, booleans, strings, symbols, functions, classes and most other types of objects.

### 3. Adding breakpoints

Adding the `debugger` statement is not the only way you can stop execution, you can also quite easily add breakpoints by clicking on the line number you want to pause at in the editor.

For example, let's add a breakpoint on the first line of the `pressedEquals` function.

![Adding Breakpoint](/images/posts/gjs-dap-report/adding-breakpoint.png)

Then we can stop and restart the debugger. In the running program, type a simple equation like `1+1`, then click `=`.

![Pressing Equals](/images/posts/gjs-dap-report/pressing-equals.png)

The debugger panel will now show that you're paused, and allow you to view the stack frames as well as the scopes.

![Equals Debugger](/images/posts/gjs-dap-report/equals-debugger.png)

With this approach, you can debug applications and pause execution at any point to inspect the state of the program.

Also note that the breakpoints tab is now updated to show the breakpoint we just set.

![Equals Breakpoints](/images/posts/gjs-dap-report/equals-breakpoints.png)

> Note: The main Calculator window might now appear as Frozen (e.g. with a "« gjs-console » is not responding" message). Don't worry, this is because the program is paused in the debugger.

> Note2: You can set/remove breakpoints anytime the app is running or before it starts.

### 4. Stepping through the code

With the application now paused, we can progressively move execution line-by-line by stepping through the code.

To "Step Over" (execute the current line and move to the next one), press the "Step Over" button in the debugger toolbar.

<video src="/images/posts/gjs-dap-report/equals-stepping.webm" loop muted autoplay controls></video>

You can also click the "Step Into" button to step into a function call (or just step over).

Here's an example where I've added a breakpoint on Line 40 (first line of `pressedOperator` button) and stepping into the `updateDisplay` function call.

<video src="/images/posts/gjs-dap-report/step-into.webm" loop muted autoplay controls></video>

Stepping back is currently not implemented.

### 5. Breaking on Exceptions

Another way to pause execution is to set to break on exceptions. The GJS debugger supports breaking on breakpoints that would either be caught (i.e. in a try {} catch {} block) or not caught (i.e. unhandled exceptions).

You can set these options by going to the Breakpoints tab and then clicking either the "Uncaught Exceptions" or "Caught Exceptions" button (or both).

![Exception Breakpoints](/images/posts/gjs-dap-report/exception-breakpoints.png)

## VS Code Extension

I've also worked on a VS Code extension, which enables debugging GJS applications inside of VS Code, however it reamins highly experimental and many features are not working yet.

This is because I focused on the Zed extension and it's the one I used during development extensively, so the VS Code extension is not as well tested as the Zed one, but I am also planning to improve it and submit it to the VS Code extensions marketplace in-time for the GNOME 52 release!

You can find instructions to use the [VS Code extension in it's repo][vscode-extension]. Here is an example of it debugging an application:

<video src="/images/posts/gjs-dap-report/vscode.webm" loop muted autoplay controls></video>

## Challenges

While working on this project, I had a few challenges:

Firstly, I really had trouble working well because of the remote nature of GSoC, and sometimes collaborating with my mentor would get off-tracked because I tended towards working alone instead of realising my mentor was available to help me.
For future participants, I would advise you to realise that your mentor is available to help you, instead of feeling like you should be 100% independent. In my experience, a mentor will usually point you to the right solution, or even help you understand topics you might otherwise get blocked on for too long.

Code-wise, the most challenging part was getting the message parsing (i.e. sending DAP messages and receiving them through stdio) to work. I tried many approaches on my own (see point 1 above) but at the end it got resolved when I decided to ask my mentor for help.

The issue was complex because we needed to have access to the standard input as a stream so we can parse the protocol's [`Content-Length: {nBytes}\r\n` headers][headers], then read the corresponding number of bytes exactly. My first instinct was to use [`Gio.DataInputStream`](https://gjs-docs.gnome.org/gio20~2.0/gio.datainputstream) directly, but it didn't because it wasn't possible to load `Gio`/`GLib` imports in the main realm.
The solution was to create a few functions (`openInputStream`, `readLine` and `readBytes`) on the C++ side since it can use the Gio/GLib APIs, then expose them to the JS code that implements the DAP communication (and linking with Firefox/Spidermonkey's Debugger API).

Another challenge I had was when implementing the VS Code extension. In the beginning, I wrote a Zed extension that would expose GJS' DAP capabilities to the Zed Editor. When working on a similar extension for VS Code, I got stuck a bit because VS Code doesn't have a native way to easily show the communications happening between the DAP client (in this case VS Code) and the DAP server (GJS), while Zed had an easy way to show them.
This effectively hid a bug where Zed was sending/requesting an extra `/r/n` in the DAP requests & responses, while VS Code was not (they both implemented the standard differently). In the end, I created a wrapper script that would also log all the communications between the client and the server differently so I can diagnose that bug and fix it.

A recommendation I would give to future GSoC participants is to also track time and progress well. When working on the project, I didn't regularly check my proposal and the different activities and their timelines, so I ended up moving/reprioritising tasks towards the end of the program, which could have been avoided if I always checked the timeline to make sure I'm still on track and adjusting early.

## Further Steps

There are some remaining tasks that could be done to make the GJS debugger better, and here's some of them.

1. Bring the VS Code extension to feature parity as the Zed extension ([see above](#vs-code-extension)).
2. Add support for debugging GJS applications in GNOME Builder: Currently blocked by [GNOME Builder itself lacking DAP support][gnome-builder-dap]
3. Add support for evaluating expressions in the debugger when paused.
4. Correctly stop/kill the script when the debug session ends.
5. Enabling source map support, which will make debugging compiled GJS (and TypeScript!) applications (like GNOME Weather, GNOME Sound Recorder) easier.
6. Testing and ensuring the debugger works well on macOS and Windows (I only tested on Linux).
7. Redirect `console.log` and other output to the debug console.
8. Allow attaching to already running GJS applications (potentially by implementing a SIGUSR1 handler and communicating via unix socket).
9. Allow pausing the program that's being debugged (at any point).
10. Implement setting or modifying variables in the debugger.
11. Give information about the current exception when we hit an exception breakpoint (needs the VS Code extension).
12. Maybe implement watching source code and live-reload of the code while debugging.
13. Implement more DAP capabilities (e.g. function breakpoints, conditional breakpoints) to improve the debugging experience even more (including correct `presentationHint`)
14. Show the scopes in a better way (e.g. merge the `global` and `GjsGlobal` scopes, potentially merge the `class body` scopes, etc...)
15. Maybe support debugging the GNOME Shell??
16. Maybe implement GJS debugging (and provide instructions) for other DAP clients like Emacs, Vim, etc. (see [full list of tools implementing DAP here][dap-tools])
17. Maybe add documentation for debugging a GJS application while developing with meson (will need to add a `run_target`).

Let me know if there's more support you may want, or if you'd like to work on any of these.

## Improving WASM Support

As part of the GSoC project, during the initial community bonding period, I also worked on [improving WASM support in GJS][wasm-mr]. The MR essentially connects WASM's event loop to the GLib main loop set up by GJS.

## Conclusion

I would like to thank Google Summer of Code for selecting me to work on this project, which I hope will improve the experience of writing, debugging and improve GJS applications.

I'd also like to thank the GNOME Project for hosting GJS, which is an important part of the GNOME ecosystem.

Finally, I'd like to thank my mentor Philip Chimento so much for his important skills, guidance, and support while I was working on this project.

You can reach out in the GNOME JavaScript room in Matrix: [`#javascript:gnome.org`][gjs-matrix] for any questions or feedback.

[midterm]: /blog/gjs-dap
[mr]: https://gitlab.gnome.org/GNOME/gjs/-/merge_requests/1112
[hacking]: https://gitlab.gnome.org/GNOME/gjs/-/blob/master/doc/Hacking.md?ref_type=heads
[zed]: https://zed.dev/
[zed-extension]: https://gitlab.gnome.org/vixalien/gjs-dap
[maps]: https://apps.gnome.org/en-GB/Maps/
[zed-extension-pr]: https://github.com/zed-industries/extensions/pull/7485
[calc]: https://gitlab.gnome.org/GNOME/gjs/-/blob/master/examples/calc.js?ref_type=heads
[stack-frames]: https://developer.mozilla.org/en-US/docs/Glossary/Call_stack
[gnome-builder-dap]: https://gitlab.gnome.org/GNOME/gnome-builder/-/work_items/1325
[gjs-matrix]: https://matrix.to/#/%23javascript:gnome.org
[dap-tools]: https://microsoft.github.io/debug-adapter-protocol/implementors/tools/
[wasm-mr]: https://gitlab.gnome.org/GNOME/gjs/-/merge_requests/1078
[scopes]: https://developer.mozilla.org/en-US/docs/Glossary/Scope
[headers]: https://microsoft.github.io/debug-adapter-protocol/overview#:~:text=Header%20Part
[vscode-extension]: https://gitlab.gnome.org/vixalien/gjs-dap-vscode
