#!/usr/bin/env bash
# Applies 27-0's App Store settings to the Capacitor iOS project (macOS only: uses PlistBuddy + Ruby).
# Safe to run again: every step overwrites rather than appends.
#   - iPhone only, portrait only (iPad runs it in iPhone compatibility mode)
#   - custom URL scheme com.twentysevenzero.game:// (Supabase email confirm / password reset)
#   - no non-exempt encryption (skips the export compliance question on every upload)
#   - photo-library "add" usage string (the share sheet's "Save Image" for season cards needs it)
#   - PrivacyInfo.xcprivacy added to the App target
set -euo pipefail
cd "$(dirname "$0")/.."

PLIST=ios/App/App/Info.plist
PBX=ios/App/App.xcodeproj/project.pbxproj
PB=/usr/libexec/PlistBuddy
SCHEME=com.twentysevenzero.game

[ -f "$PLIST" ] || { echo "No $PLIST: run 'npx cap add ios' first"; exit 1; }

set_key() { # key type value
  "$PB" -c "Delete :$1" "$PLIST" >/dev/null 2>&1 || true
  "$PB" -c "Add :$1 $2 $3" "$PLIST"
}

set_key CFBundleDisplayName string "27-0"
set_key CFBundleShortVersionString string '$(MARKETING_VERSION)'
set_key CFBundleVersion string '$(CURRENT_PROJECT_VERSION)'
set_key ITSAppUsesNonExemptEncryption bool false
set_key LSRequiresIPhoneOS bool true
set_key UIRequiresFullScreen bool true
set_key UIStatusBarStyle string UIStatusBarStyleLightContent
set_key NSPhotoLibraryAddUsageDescription string "27-0 saves your season card to Photos when you choose Save Image."

for key in UISupportedInterfaceOrientations "UISupportedInterfaceOrientations~ipad"; do
  "$PB" -c "Delete :$key" "$PLIST" >/dev/null 2>&1 || true
  "$PB" -c "Add :$key array" "$PLIST"
  "$PB" -c "Add :$key:0 string UIInterfaceOrientationPortrait" "$PLIST"
done

"$PB" -c "Delete :CFBundleURLTypes" "$PLIST" >/dev/null 2>&1 || true
"$PB" -c "Add :CFBundleURLTypes array" "$PLIST"
"$PB" -c "Add :CFBundleURLTypes:0 dict" "$PLIST"
"$PB" -c "Add :CFBundleURLTypes:0:CFBundleURLName string $SCHEME" "$PLIST"
"$PB" -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$PLIST"
"$PB" -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string $SCHEME" "$PLIST"

# iPhone only (no iPad screenshots needed; iPad still runs it in compatibility mode).
sed -i '' 's/TARGETED_DEVICE_FAMILY = "1,2";/TARGETED_DEVICE_FAMILY = 1;/g' "$PBX"
# Versions come from CI (data/version.ts + run number); these are the local defaults.
sed -i '' -E 's/MARKETING_VERSION = [^;]+;/MARKETING_VERSION = 1.0;/g' "$PBX"

# Privacy manifest, registered in the App target's resources.
cp ios-config/PrivacyInfo.xcprivacy ios/App/App/PrivacyInfo.xcprivacy
gem list -i xcodeproj >/dev/null 2>&1 || gem install --user-install xcodeproj --no-document >/dev/null
ruby -e '
  Gem.paths = { "GEM_PATH" => [Gem.user_dir, *Gem.path].join(":") }
  require "xcodeproj"
  project = Xcodeproj::Project.open("ios/App/App.xcodeproj")
  target = project.targets.find { |t| t.name == "App" } or abort "No App target"
  group = project.main_group.find_subpath("App", false) or abort "No App group"
  unless group.files.any? { |f| f.path == "PrivacyInfo.xcprivacy" }
    ref = group.new_reference("PrivacyInfo.xcprivacy")
    target.resources_build_phase.add_file_reference(ref, true)
    project.save
    puts "Added PrivacyInfo.xcprivacy to the App target"
  else
    puts "PrivacyInfo.xcprivacy already in the project"
  end
'
echo "iOS project configured."
