---
title: A love letter to mise
description: "using mise to install packages on an immutable distro"
publish_date: 2026-04-30
tags: [projects, explained]
---

Recently, I have been using [GNOME OS][gnome-os], as my daily driver.

After being a seasoned Linux for long, dabbling in distros like [Alpine Linux][alpine], [Arch Linux][arch], Fedora (and even Silverblue), I tried switching to something more _opinionated_ and that "works by default" all while being hard to break.

And given my existing [relationship with GNOME][gnome-rel], GNOME OS was a choice worth looking into.

One feature of GNOME OS is that it is immutable (i.e. system files are read-only). It also doesn't ship with a package manager, so it doesn't have functionality built-in to install extra packages.

You can install GUI Applications normally using [Flathub][flathub] (and Snap/AppImage), but installing non-GUI applications like development tools or CLI packages is not built-in.

There are of course several solutions you can use, such as [homebrew], [coldbrew], but today we will focus on [mise].


## What is mise?

[mise] pitches itself as "One tool to manage languages, env vars, and tasks per project, reproducibly."

However, I only use a fraction of it's functionality, in that I only use it to install packages.

## How to install it?

The instructions are here: https://mise.jdx.dev/getting-started.html

But essentially it's as easy as running this (remember to read the source of the installer first):

```bash
curl https://mise.run | sh
```

## Activating mise

Then you will need to "activate" mise, which essentially makes tools installed by mise available by modifying your `$PATH` variable

```bash
echo 'eval "$(~/.local/bin/mise activate bash --shims)"' >> ~/.bashrc
```

The instructions above are for bash, so you will need to consult the docs to get instructions for your shell.

You will need to re-login for the `mise` command to be available, or open a new shell.

### A note on shims

> Feel free to skip this section, as it's just an explainer

Also, note that the above command use the `--shims` flag, which is NOT the default. It essentially means that mise will modify the `$PATH` variable, instead of doing a weird thing where it will re-activate itself after each command you run.

The non-shim way to activate mise is useful when you use mise to install different package versions across different repositories, but that sometimes breaks IDEs and is our of the scope of this blog post.

## Installing packages

You can start installing your first package with `mise`:

```sh
mise use -g java
```

The above command installs `java` globally (hence the `-g` flag), which you can now confirm by running:

```
$ java --version
openjdk 26.0.1 2026-04-21
OpenJDK Runtime Environment (build 26.0.1+8-34)
OpenJDK 64-Bit Server VM (build 26.0.1+8-34, mixed mode, sharing)
```

You can install much more tools, of which you can find a non-complete list here: [mise-tools].

For example, you can similarly install a specific major version of nodejs

```sh
mise use -g node@22
```

Or install the latest LTS version of node

```sh
mise use -g node@lts
```

Or you can be overlay specific

```sh
mise use -g node@v25.9.0
mise use -g node@25.9.0 # this works too!
```

## Searching

Use `mise search` to find packages.

```
mise search typ
Tool       Description                                                                                                                            
typos      Source code spell checker. https://github.com/crate-ci/typos
typst      A new markup-based typesetting system that is powerful and easy to learn. https://github.com/typst/typst
typstyle   Beautiful and reliable typst code formatter. https://github.com/Enter-tainer/typstyle
quicktype  Generate types and converters from JSON, Schema, and GraphQL provided by https://quicktype.io. https://www.npmjs.com/package/quicktype
```

## Uninstalling

```
mise unuse -g node
```

## Updating

```
mise self-update # updating mise itself
mise up          # updating tools installed by mise
mise outdated    # checking if you have outdated tools
```

## Config File

Tools you install with mise globally will be saved in the file `~/.config/mise/config.toml`, which you can commit to your dotfiles so you can have similar tools across different machines.

Here's an example of my mise config file at the time of writing this blog post.

```toml
# ~/.config/mise/config.toml
[tools]
bat = "latest"
btop = "latest"
bun = "latest"
caddy = "latest"
"cargo:mergiraf" = "latest"
deno = "latest"
difftastic = "latest"
doggo = "latest"
fastfetch = "latest"
fzf = "latest"
github-cli = "latest"
"github:railwayapp/railpack" = "latest"
glab = "latest"
helix = "latest"
java = "latest"
lazygit = "latest"
node = "latest"
"npm:vscode-langservers-extracted" = "latest"
oha = "latest"
pipx = "latest"
pnpm = "latest"
prettier = "latest"
rust = "latest"
scooter = "latest"
tmux = "latest"
usage = "latest"
yt-dlp = { version = "latest", rename_exe = "yt-dlp" }
zellij = "latest"
"github:patryk-ku/music-discord-rpc" = { version = "latest", asset_pattern = "music-discord-rpc" }
rclone = "latest"
mc = "latest"
go = "latest"
"go:git.sr.ht/~migadu/alps/cmd/alps" = "latest"
"npm:localtunnel" = "latest"
```

After the tools inside the config has changed, you can run the following comand to make mise re-install packages from the config file

```
mise install
```

## Mise Backends

Mise is able to install packages from multiple sources. These sources are called "backends" by mise.

When you type `mise use -g node@22`, it will resolve `node` against the registry and figure out that the default backend for `node` is `core`

### Core

The default backend is called `core` and tools from this backend are usually provided from the official source.

Other tools that are available from `core` include Node.js, Ruby, Python, etc...

We could also have been explicit with the backend we want to use

```
mise use -g core:node
```

You can find [a list of all core packages here][mise-core].

### Aqua

You can also install packages from the [Aqua] registry.

### Language Package Managers

You can also install tools from their respective package managers. Here are a few examples

#### `npm`

You can install prettier, typescript, oxlint and other JavaScript/TypeScript tools published on the npm registry. Find the tools on [npm]

```bash
mise use -g npm:prettier
```

#### `pipx`

You can install black, poetry and other Python tools from pypi. Find the tools on [pypi]

```bash
mise use -g pipx:black
pipx:git+https://github.com/psf/black.git # from a github repo
```

#### `cargo`

You can install cargo packages with this backed. You need to have rust installed beforehand though, which you can do with mise

```bash
mise use -g rust
```

Then install your packages

```bash
mise use -g cargo:eza
```

There are more [language package manager backends][mise-backends] like: `gem`, `go` and more.

### Github

You can install packages from Github directly, as long as the project you are trying to install from uses Github releases

```bash
mise use -g github:railwayapp/railpack
```

mise will usually auto-detect which asset you want to use, but you can also specify the asset glob in `~/.config/mise/config.toml`

```toml
[tools]
"github:patryk-ku/music-discord-rpc" = { version = "latest", asset_pattern = "music-discord-rpc" }
```

[alpine]: https://alpinelinux.org
[gnome-rel]: https://teams.pages.gitlab.gnome.org/Websites/people.gnome.org/#jimmac:~:text=Angelo%20Verlain%20Shema
[arch]: https://archlinux.org
[fedora]: https://fedoraproject.org/
[flathub]: https://flathub.org/en
[homebrew]: https://brew.sh/
[coldbrew]: https://gitlab.postmarketos.org/postmarketOS/coldbrew
[mise]: https://mise.jdx.dev/
[mise-tools]: https://mise-tools.jdx.dev/
[npm]: https://www.npmjs.com/search?q=keywords:cli
[pypi]: https://pypi.org/
[mise-core]: https://mise.jdx.dev/core-tools.html
[mise-backends]: https://mise.jdx.dev/dev-tools/backends/
[aqua]: https://aquaproj.github.io/
