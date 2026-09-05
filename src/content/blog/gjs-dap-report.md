---
title: "Project Final Report: Adding Debug Adapter Protocol Support to GJS"
description: "Debugging GNOME JavaScript applications made easy"
publish_date: 2026-09-03
invert: true
tags: [gnome, debugging, gsoc]
unlisted: true
---

Hello again! A few weeks ago, I wrote about the work I've been doing this summer adding Debug Adapter Protocol (DAP) support to GJS as part of Google Summer of Code (GSoC) 2026.
If you haven't read that post, [start there][midterm] for the background on what GJS and DAP are and why this matters.

As my GSoC is wrapping up, I wanted to share you an update on what I've done, what I've learnt, and what I'm planning for the future.

Instead of a lengthy report, I actually want to walk you through debugging a real GJS application using the DAP support I've added to GJS.

By the end of this post, you'll know how to launch a GJS app in Zed, set breakpoints (including on exceptions), step through code, inspect variables and more, all from inside your editor.

## Setting Up

The code I've implemented is currently in a [Merge Request being reviewed][mr], so to you use it, you will need to clone and build GJS from source (until it's merged).

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

This will be required as long as the merge request is not merged.

> Please note the path where you cloned GJS (e.g. `~/Projects/gjs`). We will need it later.

### Editor setup

You will also need to download and install [the Zed editor][zed]. I'm still working on VS Code support.

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

This pane shows the console output of the program and allows you to potentially execute commands (not supported in the GJS debugger).

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

<video src="/images/posts/gjs-dap-report/equals-stepping.webm" loop muted autoplay></video>

You can also click the "Step Into" button to step into a function call (or just step over).

Here's an example where I've added a breakpoint on Line 40 (first line of `pressedOperator` button) and stepping into the `updateDisplay` function call.

<video src="/images/posts/gjs-dap-report/step-into.webm" loop muted autoplay></video>

Stepping back is not implemented.

### 5. Breaking on Exceptions

Another way to pause execution is to set to break on exceptions. The GJS debugger supports breaking on breakpoints that would either be caught (i.e. in a try {} catch {} block) or not caught (i.e. unhandled exceptions).

You can set these options by going to the Breakpoints tab and then clicking either the "Uncaught Exceptions" or "Caught Exceptions" button (or both).

![Exception Breakpoints](/images/posts/gjs-dap-report/exception-breakpoints.png)

## My Biggest Challenge

## Further Steps

There are some remaining tasks that could be done to make the GJS debugger better, and here's some of them.

1. Make it possible to debug GJS applications in VS Code by writing a VS Code extension for the GJS Debugger: I tried but didn't have much success.
2. Add support for debugging GJS applications in GNOME Builder: Currently blocked by [GNOME Builder itself lacking DAP support][gnome-builder-dap]
3. Add support for evaluating expressions in the debugger when paused.
4. Correctly stop/kill the script when the debug session ends.

Let me know if there's more support you may want, or if you'd like to work on any of these.

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
