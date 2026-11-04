"""Render one cap in neutral clay to inspect its planar inclined top."""
import bpy
from pathlib import Path
from mathutils import Vector,Matrix
folder=Path(__file__).resolve().parent/'review'
bpy.ops.wm.open_mainfile(filepath=str(folder/'Hyzen67.blend'))
source=next(obj for obj in bpy.data.objects if 'top_rise_mm' in obj and obj.parent.parent['keyName']=='A')
for obj in bpy.data.collections['HYZEN 67 · exterior'].objects:obj.hide_render=True
sample=source.copy();sample.data=source.data.copy();sample.parent=None
bpy.context.scene.collection.objects.link(sample);sample.matrix_world=Matrix.Identity(4)
sample.hide_render=False;sample.hide_set(False)
clay=bpy.data.materials.new('Neutral geometry review');clay.use_nodes=True
bsdf=clay.node_tree.nodes['Principled BSDF'];bsdf.inputs['Base Color'].default_value=(.28,.34,.40,1);bsdf.inputs['Roughness'].default_value=.42
sample.data.materials.clear();sample.data.materials.append(clay)
for face in sample.data.polygons:face.material_index=0
scene=bpy.context.scene;scene.cycles.samples=64
for obj in bpy.data.objects:
    if obj.name=='Studio ground':obj.hide_render=True
bpy.ops.mesh.primitive_plane_add(size=2000,location=(0,0,-.35));floor=bpy.context.object
floor.data.materials.append(bpy.data.materials['Studio white'])
for name,position,look,scale in [
    ('cap-side-shallow',(100,0,4.8),(0,0,4.8),26),
    ('cap-angle-shallow',(36,-55,42),(0,0,4.8),38)
]:
    floor.hide_render=name.startswith('cap-side')
    bpy.ops.object.camera_add(location=position);camera=bpy.context.object
    camera.rotation_euler=(Vector(look)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=scale;camera.data.clip_end=5000
    scene.camera=camera;scene.render.resolution_x=1600;scene.render.resolution_y=950
    scene.render.filepath=str(folder/(name+'.png'));bpy.ops.render.render(write_still=True)
    print('CAP_REVIEW_READY '+name,flush=True)
