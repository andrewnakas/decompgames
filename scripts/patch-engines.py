from pathlib import Path
import os
root=Path(os.environ.get('DECOMP_BUILD_ROOT', '/home/nakas/decompgames-build'))
p=root/'pinball-web/CMakeLists.txt'
s=p.read_text().replace('-s DEMANGLE_SUPPORT=1','-s EXPORTED_RUNTIME_METHODS=FS,IDBFS,callMain,addRunDependency,removeRunDependency').replace('-s EXPORTED_RUNTIME_METHODS=FS,IDBFS,callMain ','-s EXPORTED_RUNTIME_METHODS=FS,IDBFS,callMain,addRunDependency,removeRunDependency ').replace('${CMAKE_CURRENT_SOURCE_DIR}/game_resources@game_resources','${CMAKE_CURRENT_SOURCE_DIR}/../cadet-runtime@game_resources')
p.write_text(s.replace('../cadet@game_resources','../cadet-runtime@game_resources'))
p=root/'scummvm/dists/emscripten/custom_shell-pre.js'
p.write_text('/* Decomp Games supplies arguments; external MIDI is not requested. */\nvar midiOutputMap;\n')
p=root/'scummvm/configure'
s=p.read_text().replace('EXPORTED_RUNTIME_METHODS=[ccall,lengthBytesUTF8,setValue,writeArrayToMemory]','EXPORTED_RUNTIME_METHODS=[ccall,lengthBytesUTF8,setValue,writeArrayToMemory,FS,IDBFS,addRunDependency,removeRunDependency]')
p.write_text(s)
p=root/'scummvm/backends/fs/emscripten/emscripten-fs-factory.cpp'
s=p.read_text().replace('fetch("scummvm.ini")','fetch("/engine/scummvm.ini")')
p.write_text(s)
p=root/'openttd/CMakeLists.txt'
s=p.read_text().replace('\\\"cwrap\\\", \\\"HEAPU8\\\"','\\\"cwrap\\\", \\\"HEAPU8\\\", \\\"FS\\\", \\\"IDBFS\\\"')
p.write_text(s)
p=root/'openttd/os/emscripten/pre.js'
p.write_text(p.read_text().replace("'-mnull', '-snull', '-vsdl'", "'-mnull', '-ssdl', '-vsdl'"))
