"""Short-side view of the actual five-row mesh, with the deck tilt removed."""
import bpy,math,sys
from pathlib import Path
from mathutils import Vector,Matrix
folder=Path(__file__).resolve().parent/'review'
bpy.ops.wm.open_mainfile(filepath=str(folder/'Hyzen67.blend'))
sources=[obj for obj in bpy.data.objects if 'top_rise_mm' in obj and obj.parent.parent['keyName'] in ('Esc','Tab','CapsLock','Left-Shift','Left-Ctrl')]
for obj in bpy.data.collections['HYZEN 67 · exterior'].objects:obj.hide_render=True
clay=bpy.data.materials.new('Neutral row profile');clay.use_nodes=True
clay.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.25,.30,.36,1)
clay.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.48
untilt=Matrix.Rotation(math.radians(-12),4,'X')
copies=[]
for source in sources:
    copy=source.copy();copy.data=source.data.copy();copy.parent=None
    bpy.context.scene.collection.objects.link(copy);copy.matrix_world=untilt@source.matrix_world
    copy.hide_render=False;copy.hide_set(False);copy.data.materials.clear();copy.data.materials.append(clay)
    for face in copy.data.polygons:face.material_index=0
    copies.append(copy)
positions=[copy.matrix_world@Vector(corner) for copy in copies for corner in copy.bound_box]
center=Vector(((min(p.x for p in positions)+max(p.x for p in positions))/2,(min(p.y for p in positions)+max(p.y for p in positions))/2,(min(p.z for p in positions)+max(p.z for p in positions))/2))
for obj in bpy.data.collections['Studio · not part of keyboard'].objects:
    if obj.type=='MESH':obj.hide_render=True
scene=bpy.context.scene;scene.cycles.samples=64
for name,position,scale,res in [
    ('rows-short-side',center+Vector((-650,0,0)),112,(2000,480)),
    ('rows-profile-angle',center+Vector((-150,-45,95)),116,(2000,750))
]:
    if '--housing-only' in sys.argv:continue
    bpy.ops.object.camera_add(location=position);camera=bpy.context.object
    camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=scale;camera.data.clip_end=5000
    scene.camera=camera;scene.render.resolution_x,scene.render.resolution_y=res
    scene.render.filepath=str(folder/(name+'.png'));bpy.ops.render.render(write_still=True)
    print('ROW_PROFILE_READY '+name,flush=True)
for copy in copies:copy.hide_render=True
for obj in bpy.data.collections['HYZEN 67 · exterior'].objects:obj.hide_render=False
# Illuminate the short-side plane so its horizontal trim and underside facet
# remain visible; the main studio is arranged for the opposite three-quarter view.
fill=bpy.data.lights.new('Short-side inspection fill','AREA');fill.energy=900000
fill.shape='RECTANGLE';fill.size=420;fill.size_y=220
lamp=bpy.data.objects.new('Short-side inspection fill',fill);scene.collection.objects.link(lamp)
lamp.location=(-420,-80,210);lamp.rotation_euler=(Vector((0,0,22))-lamp.location).to_track_quat('-Z','Y').to_euler()
scene.camera=bpy.data.objects['03 · left profile']
scene.render.resolution_x=1800;scene.render.resolution_y=850
scene.render.filepath=str(folder/'rows-housing-side.png')
bpy.ops.render.render(write_still=True)
print('ROW_HOUSING_SIDE_READY',flush=True)
