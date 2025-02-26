---
title: My Alpine Setup
description: Exploring a minimal but nice alpine setup.
publish_date: 2024-02-18
tags: [linux]
hero_image: /images/posts/an-alpine-setup/banner.webp
---

This is a guide to install alpine, based on my own likings. It is a relatively
easy install.

This installation guide is very inspired and based on
[Hugo's Installation Guide][hugo-guide].

## (Some) security considerations

This install is a bit more secure because it uses an encrypted filesystem (LUKS
on top of LVM).

The whole is configured to work with UEFI + Secureboot, and the disk is
automatically decrypted with the TPM (this secure chip inside your laptop) using
[Clevis], meaning, if you boot on your laptop, your file contents will be
decrypted automatically. You will need to manually enter your password if the
storage drive is used outside of your computer (evil maid attack).

To secure your laptop better, enable Secure Boot, and set a very strong
BIOS/UEFI password.

A more secure approach would be to use something like [systemd-homed] that
encrypts each user's home directory separately, but that requires systemd...
There's a similar tool for alpine called [pam_mount], but it's not compatible
with home directories created with systemd-homed, and I haven't figured a very
nice way to make it work on Alpine.

## Setup the installer

Download the alpine installation disk from the
[Alpine downloads page][alpine-downloads], flash it to a USB and boot it up.

## Configuring Alpine

Alpine has a very nice `setup-alpine` script that setups the Alpine
installation. This is different from Arch where you'd need to do everything
manually. We are going to do it to configure most stup, until we arrive to the
Partitioning stage.

- Keyboard: `us`.
- Keyboard variation: `us`.
- Hostname: `name.vixalien.com`.
- Network adapter: `wlan0`.
- Wifi network.
- Wifi password.
- IP address: `dhcp`.
- Networks: `done`.
- Manual network configuration: `n`.
- root password: `stronkpassword`
- Time zone: `Africa/Kigali`.
- User account: `alien`. This user will automatically be a member of the wheel
  group, and has (by default) privileges to use `doas` (alpine's alternative to
  `sudo`).
- The defaults are fine for all remaining steps.

> Make Sure to stop the `setup-alpine` tool when they ask for disk, as we will
> do it manually.

## Partitioning

Firstly, we will need to create a boot partition (aka EFI System Partition) to
hold all our kernel information and bootloader (optional). Please make the
partition 500 MB large, otherwise some distros like Fedora might refuse it, and
the space might run out faster than you think if you decide to make backups of
your UKIs or go distro-hopping, so 1GB is actually a better recommendation.

Then we are going to create an [LVM] partition that will be encrypted and have
volumes for all our other partitions (alpine, home, swap...). I ('d) like to
setup one partition called `linux` so it can be reused by my other linux
installations.

### Installing the necessary packages.

For partitioning, we will use gdisk. Let's also install other packages for ext4
and btrfs filesystems.

```sh
apk add lsblk gptfdisk btrfs-progs e2fsprogs
```

Activate the btrfs kernel module:

```sh
modprobe btrfs
```

cryptsetup is needed for LUKS encryption

```sh
apk add cryptsetup
```

LVM

```sh
apk add lvm2
```

### Overwriting the disk

It might be a good idea to overwrite the disk using a tool like `haveged` to
clear any leftover data.

> TODO: there is probably an alternative for SSDs

### Setup Disks

```sh
gdisk /dev/nvme0n1
```

Use `n` to create 2 partitions:

1. EFI partition. size: `512M`. GUID: `ef00` (EFI System Partition)
2. LVM partition. size: `(leave blank)`. GUID: `8309` (Linux LUKS)

> For more info about gdisk Hex codes see
> https://wiki.archlinux.org/title/GPT_fdisk#Partition_type

Populate `/dev` with new partitions:

`partprobe /dev/nvme0n1`

### Identify your partitions

Find your partition names using `lsblk`:

```
NAME         MAJ:MIN RM   SIZE RO TYPE  MOUNTPOINTS
nvme0n1      259:0    0 511.9G  0 disk  
├─nvme0n1p1  259:1    0   500M  0 part  
└─nvme0n1p2  259:2    0 511.5M  0 part
```

In this case, `/dev/nvme0n1p1` is the EFI partition, while `/dev/nvme0n1p2` will
be our LUKS partition.

### Configuring LUKS

This step will ask for a password to encrypt your whole disk with. Remember it,
and make it strong.

```sh
cryptsetup luksFormat /dev/nvme0n1p2
```

> You might want to familiarise yourself with
> [different LUKS options][luks-options]. I find the defaults okay.

Open the LUKS partition:

```sh
cryptsetup luksOpen /dev/nvme0n1p2 lvmcrypt
```

### LVM Physical and Logical Volumes

Create a physical volume

```sh
pvcreate /dev/vg0/lvmcrypt
```

Create a virtual volume named `vg0` (or something else, this one is memorable)

```sh
vgcreate vg0 /dev/vg0/lvmcrypt
```

#### Create partitions

Swap partition. I have a 32GB RAM laptop:

```sh
lvcreate -L 32G vg0 -n swap # I have a 32GB RAM laptop
lvcreate -L 50G vg0 -n alpine # root
lvcreate l 100%FREE vg0 -n home
```

#### Create file systems

```sh
mkfs.exfat /dev/nvme0n1p1
mkfs.btrfs /dev/vg0/alpine
mkfs.ext4 /dev/vg0/home
```

#### Activate swap

```sh
mkswap /dev/vg0/swap
swapon /dev/vg0/swap
```

#### Create Btrfs Subvolumes

Temporarily mount the `alpine` partition to create subvolumes.

```sh
mount /dev/vg0/alpine /mnt
```

Create the subvolumes adapted from
[Snapper's Suggested filesystem layout][snapper-layout]

```sh
btrfs subvolume create /mnt/@ # /
btrfs subvolume create /mnt/@var_log # /var/log
```

Find the id of the `@` subvolume. Note it as `<root-subvol-id>`. It will
probably be 256 or something.

```sh
btrfs subvolume list /mnt
```

Change the default subvolume to `@` (Replace `<root-subvol-id>` with the ID you
got from the previous step).

```sh
btrfs subvolume set-default <root-subvol-id> /
```

Unmount the partition

```sh
umount /mnt
```

#### Mount partitions

Create mountpoints and mount our partitions and subvolumes

```sh
mount /dev/vg0/alpine -o subvol=@ /mnt/

# Create mountpoints
mkdir -p /mnt/boot /mnt/boot /mnt/var/log

# Mount the remaining subvolumes
mount /dev/vg0/alpine -o subvol=@var_log /mnt/var/log

# Mount the efi system partition
mount /dev/nvme0n1p1 /mnt/boot

# Mount the home partition
mount /dev/vg0/home /mnt/home
```

## Installation

### Install a base alpine system

```sh
BOOTLOADER=none setup-disk -k edge /mnt
```

The `BOOTLOADER=none` tells the script to not install any bootloader (grub is
the default), and `-k edge` tells the script to install the `edge` kernel
instead of the `lts` one.

### Chroot into the filesystem

```sh
chroot /mnt
mount -t proc proc /proc
mount -t devtmpfs dev /dev
```

Switch to the edge branch, and enable the community and testing repositories.
This is done by editing `/etc/apk/repositories` and replacing its contents with:

```
http://dl-cdn.alpinelinux.org/alpine/edge/main
http://dl-cdn.alpinelinux.org/alpine/edge/community
http://dl-cdn.alpinelinux.org/alpine/edge/testing
```

> You can choose a [mirror] closer to you if you want

#### Setup a local apk cache

I like having my downloaded apks available locally. In case I want to reinstall
them or something... You can skip this step if you want a really minimal design.
When prompted, say `/var/cache/apk` for the cache directory.

```sh
setup-apkcache
```

### (No) bootloader

The next step would be to install a bootloader like GRUB or
systemd-boot/gummiboot. However, we don't need one of them since we instead
create a [Unified Kernel Image][uki] (UKI) which can be directly booted by the
UEFI firmware, hence removing the need for a traditional bootloader. A UKI
contains the following, and some more:

- The kernel itself
- The kernel’s command line parameters
- A small stub that execute the kernels with that command line
- The [initramfs] (or initrd): a small read-only filesystem with the necessary
  userspace utilities to boot into the main system.

The stub itself is provided by the `gummiboot-efistub` package. It is considered
deprecated, but no solid alternative is available. The bundle itself is built by
`efi-mkuki`, and `secureboot-hook` will rebuild the bundle after each kernel
upgrade.

```sh
apk add secureboot-hook gummiboot-efistub
```

Install `blkid` which will be used in a moment. This tool prints the UUID (and a
few other details) for a specified partition. This is the recommended way to
address a partition ambiguously:

```sh
apk add blkid
```

#### secureboot-hook

Edit `/etc/kernel-hooks.d/secureboot.conf` with the following contents.

```
cmdline=/etc/kernel/cmdline
signing_disabled=yes
output_dir="/boot/EFI/Linux"
output_name="alpine-linux-{flavor}.efi"
```

`/<efi>/EFI/Linux` is a more or less standard directory, and will be discovered
by `systemd-boot` if you have that installed.

Signing is disabled only temporarily until I install the proper keys.

#### /etc/kernel/cmdline

Also create a file `/etc/kernel/cmdline` that will contain arguments passed to
the kernel from the bootloader (UKI, in this case).

```
root=UUID=5021db58-cc3a-4829-a630-2d468f8d1761
rootflags=subvol=@
rootfstype=btrfs
cryptroot=UUID=0db973a0-1b95-4a23-a63f-cb6248fe2bf7
cryptdm=lvmcrypt
cryptkey
modules=sd-mod,btrfs,nvme
quiet
ro
```

The `root` UUID can be determined with:

```sh
blkid /dev/vg0/alpine >> /etc/kernel/cmdline
```

The `cryptroot` UUID:

```sh
blkid /dev/nvme0n1p2 >> /etc/kernel/cmdline
```

#### initrams

Edit `/etc/mkinitfs/mkinitfs.conf` to add `features` which are needed for our
encrypted root setup to work. While editing this line, it is also safe to delete
`virtio`, which is used only in virtual machines. Also add `kms` to enable
kernel mode setting. These features will be included in the generated
[initramfs].

```sh
features="ata base ide scsi usb btrfs ext4 lvm kms keymap nvme cryptsetup cryptkey resume"
disable_trigger=yes
```

#### Boot Entry

We use `efibootmgr` to create a boot entry that (hopefully) shows in the EFI
firmware, although you can always use the UFI's boot from file function or
execute the UKI from a UEFI shell. I heard reports that the boot entries may
disappear after firmware upgrades or other vendor EFI quirks, so bear that in
mind.

First exit the chroot using `exit`. We can't use `efibootmgr` inside the chroot
because it won't be able to read and set the EFI variables, mounted at
`/sys/firmware/efi/efivars`. Then install efibootmgr:

```sh
apk add efibootmgr
```

Then create a boot entry named "Alpine Linux".

```sh
efibootmgr --disk /dev/nvme0n1 --part 1 --create --label 'Alpine Linux' --load /EFI/Linux/alpine-linux-edge.efi --verbose
```

> Note: This procedure only needs to be done once; after that the Unified Kernel
> Image will be generated automatically every time the kernel is upgraded.

Finally, trigger the newly created kernel hook so that all the right files are
copied into `/boot`

```
apk fix kernel-hooks
```

### Hibernation

To setup hibernation, we'll first need to find the UUID of our swap partition:

```sh
lsblk -f
```

Edit the `/etc/kernel/cmdline` to let the system know where you will be resuming
from.

```prop
resume=UUID=<UUID of /dev/vg0/swap>
```

Enable the swap service during boot:

```sh
rc-update add swap default
```

Install `zzz` and test hibernation

```sh
apk add zzz
zzz -Z # or ZZZ
```

You can now reboot and test your system

## Desktop

### Fonts

Installing the Noto fonts make almost every characters rendered (CJK and emoji):

```sh
apk add font-noto font-noto-cjk font-noto-extra font-noto-emoji
```

Install my preferred fonts

```sh
apk add font-jetbrains-mono font-liberation-serif
```

And configure fontconfig to use them at `/etc/fonts/local.conf`

```xml
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <alias>
    <family>sans-serif</family>
    <prefer>
      <family>Cantarell</family>
    </prefer>
  </alias>
  <alias>
    <family>monospace</family>
    <prefer>
      <family>JetBrains Mono</family>
    </prefer>
  </alias>
  <alias>
    <family>serif</family>
    <prefer>
      <family>Liberation Serif</family>
    </prefer>
  </alias>
</fontconfig>
```

### Snapper

[Snapper] is a tool to automatically or manually take snapshots of btrfs
systems. I use it because I sometimes mess up my root system. Let's install it
and setup up our first snapshot.

> Remember: Snapshots are **NOT** backups.

```sh
apk add snapper

snapper -c root create-config /
```

This will create a new subvolume at `/.snapshots`. Each snapshot will be stored
at `/.snapshot/<snapshot-number>/snapshot`. It will also add a new line to
`/etc/conf.d/snapper`.

Create a first snapshot:

```sh
snapper -c config create --description 'Base Installation'
```

You can also use LVM snaphots, but that is an alternative I have not explored
yet. It like a more interesting option tbf.

### Enable & Start function

I like to have this function handy. It is synonymous to
`systemctl enable --now`. You can put it in /etc/profile or somewhere

```sh
rc-init() {
  if [ $# -lt 1 ] || [ $# -gt 2 ]
  then
    >&2 echo "Invalid number of arguments provided (1-2 acceptable)"
    return 1
  fi

  RUNLEVEL="${2:-default}";
  rc-service $1 start
  rc-update add $1 $RUNLEVEL;
}

rc-deinit() {
  if [ $# -lt 1 ] || [ $# -gt 2 ]
  then
    >&2 echo "Invalid number of arguments provided (1-2 acceptable)"
    return 1
  fi

  RUNLEVEL="${2:-default}";
  rc-service $1 stop
  rc-update del $1 $RUNLEVEL;
}
```

### GNOME

Setup the GNOME Desktop Environment (what I use, No I don't use sway or hyprland
yet:\))

```sh
setup-desktop gnome
```

Allow updates to be carried out in GNOME Software.

```sh
rc-init apk-polkit-server
```

Allow switching the power profiles in the quick settings

```sh
apk add power-profiles-daemon
```

If you have a convertible, allow turning your laptop to flip it

```sh
apk add iio-sensor-proxy
```

Hardware acceleration

```sh
apk add intel-media-driver
```

### NetworkManager

Setup NetworkManager to manage your... network. Also setup WiFi and a TUI
(`nmtui`). I also prefer using `iwd` instead of `wpa_supplicant` as the actual
WiFi backend, since it's what I'm familiar with.

```sh
apk add networkmanager networkmanager-wifi networkmanager-wifi networkmanager-dnsmasq
```

I like to use this configuration:

```toml
[main] 
dhcp=internal
plugins=keyfile
dns=dnsmasq

[device]
wifi.scan-rand-mac-address=yes
wifi.backend=wpa_supplicant

[connectivity]
uri=http://nmcheck.gnome.org/check_network_status.txt
```

There are probably other configuration options to set.

Enable and activate the service:

```sh
rc-init networkmanager
```

Since we are now using NetworkManager to manage our connections, we can disable
the default networking service.

```sh
rc-update del networking
```

You might also see that `chronyd` takes a while to sync on boot. We can tell it
to do that in the background on boot instead by editing `/etc/conf.d/chronyd`
and setting

```
FAST_STARTUP=yes
```

### Bluetooth

```sh
apk add bluez bluez-openrc
```

Enable the Bluetooth experimental features to view the battery charge of your
bluetooth earphones at `/etc/bluetooth/main.conf`

```toml
Experimental=True
```

Reboot or load the kernel module

```sh
modprobe btusb
```

Start & enable the bluetooth service

```sh
rc-service bluetooth start
rc-update add bluetooth default
```

### Sound

By default, checking `dmesg` seems to indicate missing firmware:

```
> dmesg | grep firmw
[    1.096997] i915 0000:00:02.0: [drm] Finished loading DMC firmware i915/tgl_dmc_ver2_12.bin (v2.12)
[   36.239398] iwlwifi 0000:00:14.3: loaded firmware version 77.2df8986f.0 QuZ-a0-hr-b0-77.ucode op_mode iwlmvm
[   36.363387] Bluetooth: hci0: Minimum firmware build 1 week 10 2014
[   36.365863] Bluetooth: hci0: Found device firmware: intel/ibt-19-0-4.sfi
[   36.447917] sof-audio-pci-intel-tgl 0000:00:1f.3: Direct firmware load for intel/sof/sof-tgl.ri failed with error -2
[   36.447919] sof-audio-pci-intel-tgl 0000:00:1f.3: error: sof firmware file is missing, you might need to
[   36.447921] sof-audio-pci-intel-tgl 0000:00:1f.3: error: failed to load DSP firmware -2
[   36.714932] psmouse serio1: trackpoint: Elan TrackPoint firmware: 0xa1, buttons: 3/3
[   38.519487] Bluetooth: hci0: Waiting for firmware download to complete
```

```sh
apk add sof-firmware
```

Reboot or try to load the kernel module using the relevant soundcard name found
using `find /lib/modules/* -type f -name '*.zst' -name '*sof*' -name '*tgl'`:

```sh
modprobe sof-audio-pci-intel-tgl
```

Install PipeWire packages and friends.

```sh
apk pipewire wireplumber pipewire-pulse pipewire-alsa pipewire-spa-bluez gst-plugin-pipewire
```

## Future considerations

- Use Unl0kr
- Use Clevis

References:

- ["Setting up an Alpine Linux workstation" by Hugo Osvaldo Barrera][hugo-guide]
- ["In Praise of Alpine and APK" by Hugo Osvaldo Barrera](https://whynothugo.nl/journal/2023/02/18/in-praise-of-alpine-and-apk/)
- ["In Praise of Alpine" by Drew Devault](https://drewdevault.com/2021/05/06/Praise-for-Alpine-Linux.html)
- [Full disk encryption secure boot - Alpine Wiki](https://wiki.alpinelinux.org/wiki/Full_disk_encryption_secure_boot)
- [UEFI Secure Boot - Alpine Wiki](https://wiki.alpinelinux.org/wiki/UEFI_Secure_Boot)

[hugo-guide]: https://whynothugo.nl/journal/2023/11/19/setting-up-an-alpine-linux-workstation/
[alpine-downloads]: https://alpinelinux.org/downloads/
[luks-options]: https://wiki.archlinux.org/title/Dm-crypt/Device_encryption#Encryption_options_for_LUKS_mode
[snapper-layout]: https://wiki.archlinux.org/title/Snapper#Suggested_filesystem_layout
[mirror]: https://mirrors.alpinelinux.org/
[uki]: https://wiki.archlinux.org/title/Unified_kernel_image
[initramfs]: https://wiki.archlinux.org/title/Arch_boot_process#initramfs
[clevis]: https://wiki.archlinux.org/title/Clevis
[systemd-homed]: https://systemd.io/HOME_DIRECTORY/
[pam_mount]: https://wiki.archlinux.org/title/pam_mount
[lvm]: https://wiki.archlinux.org/title/LVM
[snapper]: https://wiki.archlinux.org/title/Snapper
