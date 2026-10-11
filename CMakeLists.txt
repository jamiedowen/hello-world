cmake_minimum_required(VERSION 3.22)

project(Midnight84 VERSION 1.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(APPLE)
    set(CMAKE_OSX_DEPLOYMENT_TARGET "10.13" CACHE STRING "Minimum macOS version")
    set(CMAKE_OSX_ARCHITECTURES "arm64;x86_64" CACHE STRING "Build universal binaries")
endif()

if(MSVC)
    # Static runtime so the plugin doesn't need the VC++ redistributable.
    set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
endif()

# JUCE is fetched automatically. To use a local checkout instead, configure with
#   -DFETCHCONTENT_SOURCE_DIR_JUCE=/path/to/JUCE
include(FetchContent)
FetchContent_Declare(
    JUCE
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG 8.0.4
    GIT_SHALLOW ON)
FetchContent_MakeAvailable(JUCE)

set(M84_FORMATS VST3 Standalone)
if(APPLE)
    list(APPEND M84_FORMATS AU)
endif()

juce_add_plugin(Midnight84
    COMPANY_NAME "Midnight Audio"
    BUNDLE_ID "com.midnightaudio.midnight84"
    PLUGIN_MANUFACTURER_CODE Mdna
    PLUGIN_CODE Mn84
    FORMATS ${M84_FORMATS}
    PRODUCT_NAME "Midnight 84"
    IS_SYNTH TRUE
    NEEDS_MIDI_INPUT TRUE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS FALSE
    COPY_PLUGIN_AFTER_BUILD FALSE
    VST3_CATEGORIES Instrument Synth
    AU_MAIN_TYPE kAudioUnitType_MusicDevice)

target_sources(Midnight84 PRIVATE
    Source/Arpeggiator.cpp
    Source/Components.cpp
    Source/Effects.cpp
    Source/LookAndFeel.cpp
    Source/Parameters.cpp
    Source/PluginEditor.cpp
    Source/PluginProcessor.cpp
    Source/Presets.cpp
    Source/SynthEngine.cpp)

target_compile_definitions(Midnight84 PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
    JUCE_DISPLAY_SPLASH_SCREEN=0)

target_link_libraries(Midnight84
    PRIVATE
        juce::juce_audio_utils
        juce::juce_dsp
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags)

# Offline render / screenshot harness: cmake -DM84_BUILD_TESTS=ON
option(M84_BUILD_TESTS "Build the offline render test tool" OFF)
if(M84_BUILD_TESTS)
    juce_add_console_app(Midnight84RenderTest PRODUCT_NAME "Midnight84RenderTest")
    target_sources(Midnight84RenderTest PRIVATE tests/RenderTest.cpp)
    target_compile_definitions(Midnight84RenderTest PRIVATE JUCE_WEB_BROWSER=0 JUCE_USE_CURL=0)
    target_link_libraries(Midnight84RenderTest PRIVATE Midnight84 juce::juce_audio_utils juce::juce_dsp
        juce::juce_recommended_config_flags)

    juce_add_console_app(Midnight84FullSong PRODUCT_NAME "Midnight84FullSong")
    target_sources(Midnight84FullSong PRIVATE tests/FullSong.cpp)
    target_compile_definitions(Midnight84FullSong PRIVATE JUCE_WEB_BROWSER=0 JUCE_USE_CURL=0)
    target_link_libraries(Midnight84FullSong PRIVATE Midnight84 juce::juce_audio_utils juce::juce_dsp
        juce::juce_recommended_config_flags)

    foreach(tool Midnight84RenderTest Midnight84FullSong)
        if(NOT MSVC)
            target_compile_options(${tool} PRIVATE -Wno-missing-field-initializers -Wno-float-equal)
        endif()
    endforeach()

    juce_add_console_app(Midnight84DemoSong PRODUCT_NAME "Midnight84DemoSong")
    target_sources(Midnight84DemoSong PRIVATE tests/DemoSong.cpp)
    target_compile_definitions(Midnight84DemoSong PRIVATE JUCE_WEB_BROWSER=0 JUCE_USE_CURL=0)
    target_link_libraries(Midnight84DemoSong PRIVATE Midnight84 juce::juce_audio_utils juce::juce_dsp
        juce::juce_recommended_config_flags)
    if(NOT MSVC)
        target_compile_options(Midnight84DemoSong PRIVATE -Wno-missing-field-initializers -Wno-float-equal)
    endif()
endif()
