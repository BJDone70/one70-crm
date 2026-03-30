#!/usr/bin/env ruby
# Adds the ShareExtension target to the Xcode project
require 'xcodeproj'

build_dir = ENV['CM_BUILD_DIR'] || '.'
project_path = File.join(build_dir, 'ios', 'App', 'App.xcodeproj')
project = Xcodeproj::Project.open(project_path)

# Skip if already added
if project.targets.any? { |t| t.name == 'ShareExtension' }
  puts "ShareExtension target already exists, skipping."
  exit 0
end

puts "Adding ShareExtension target..."

# Verify files exist on disk
ext_dir = File.join(build_dir, 'ios', 'App', 'ShareExtension')
swift_path = File.join(ext_dir, 'ShareViewController.swift')
unless File.exist?(swift_path)
  puts "ERROR: #{swift_path} not found!"
  exit 1
end
puts "  Found ShareViewController.swift"

# Create the target
target = project.new_target(:app_extension, 'ShareExtension', :ios, '15.0')
target.build_configuration_list.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.one70group.crm.ShareExtension'
  config.build_settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['CODE_SIGN_STYLE'] = 'Manual'
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'ShareExtension/ShareExtension.entitlements'
  config.build_settings['INFOPLIST_FILE'] = 'ShareExtension/Info.plist'
  config.build_settings['MARKETING_VERSION'] = '1.0.0'
  config.build_settings['CURRENT_PROJECT_VERSION'] = '1'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'NO'
  config.build_settings['ENABLE_BITCODE'] = 'NO'
  config.build_settings['LD_RUNPATH_SEARCH_PATHS'] = [
    '$(inherited)',
    '@executable_path/Frameworks',
    '@executable_path/../../Frameworks'
  ]
end

# Add file group with relative path from xcodeproj
share_group = project.main_group.find_subpath('ShareExtension', true)
share_group.set_source_tree('<group>')
share_group.set_path('ShareExtension')

# Add Swift file using relative name within the group
swift_ref = share_group.new_reference('ShareViewController.swift')
swift_ref.set_source_tree('<group>')
target.source_build_phase.add_file_reference(swift_ref)
puts "  Added ShareViewController.swift"

# Wire up main app dependency and embed phase
main_target = project.targets.find { |t| t.name == 'App' }
if main_target
  main_target.add_dependency(target)
  puts "  Added dependency on App target"

  embed_phase = main_target.build_phases.find { |p|
    p.is_a?(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase) && p.name == 'Embed App Extensions'
  }
  unless embed_phase
    embed_phase = project.new(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase)
    embed_phase.name = 'Embed App Extensions'
    embed_phase.dst_subfolder_spec = '13'
    embed_phase.dst_path = ''
    main_target.build_phases << embed_phase
    puts "  Created Embed App Extensions phase"
  end

  product_ref = target.product_reference
  build_file = embed_phase.add_file_reference(product_ref, true)
  build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
  puts "  Embedded extension in App"
else
  puts "WARNING: Could not find App target!"
end

project.save
puts "ShareExtension target added successfully!"
