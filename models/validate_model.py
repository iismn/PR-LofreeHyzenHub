"""Read-only geometry checks on review/Hyzen67.blend; write a JSON report."""
import bpy,bmesh,json,math
from pathlib import Path
from mathutils import Vector
folder=Path(__file__).resolve().parent/'review'
bpy.ops.wm.open_mainfile(filepath=str(folder/'Hyzen67.blend'))
keys=[o for o in bpy.data.objects if 'hyzenKeyCode' in o]
caps=[o for o in bpy.data.objects if 'dish_depth_mm' in o]
checks=[]
checks.append({'name':'67 distinct physical key groups','ok':len(keys)==67 and len({o['hyzenKeyCode'] for o in keys})==67})
backspace=next(o for o in keys if o['keyName']=='Backspace');enter=next(o for o in keys if o['keyName']=='Enter')
checks.append({'name':'Backspace is 2U and Enter is 2.25U at 19.05 mm pitch','ok':backspace['width_units']==2 and enter['width_units']==2.25 and abs(backspace['key_width_mm']-37.05)<.0001 and abs(enter['key_width_mm']-41.8125)<.0001})
checks.append({'name':'67 photo roof regions are complete and stay inside the product image','ok':all(len(o['photoUvRect'])==4 and 0<o['photoUvRect'][0]<o['photoUvRect'][2]<1 and 0<o['photoUvRect'][1]<o['photoUvRect'][3]<1 for o in keys)})
planes=[]
for cap in caps:
    slope=math.tan(math.radians(cap['top_incline_degrees']))
    indices={i for face in cap.data.polygons if face.material_index==1 for i in face.vertices}
    half_depth=cap['typing_depth_mm']/2;rise=cap['top_rise_mm'];height=cap['edge_height_mm']
    residuals=[abs(cap.data.vertices[i].co.z-(height+slope*cap.data.vertices[i].co.y+rise*(1-(cap.data.vertices[i].co.y/half_depth)**2))) for i in indices]
    error=max(residuals)
    bm=bmesh.new();bm.from_mesh(cap.data);nonmanifold=sum(not edge.is_manifold for edge in bm.edges);bm.free()
    planes.append({'key':cap.parent.parent['keyName'],'surface_error_mm':error,'center_offset_mm':rise,'nonmanifold_edges':nonmanifold})
checks.append({'name':'67 individual key tops are planar','ok':len(caps)==67 and all(p['surface_error_mm']<.00001 and abs(p['center_offset_mm'])<.00001 for p in planes)})
checks.append({'name':'67 watertight hollow cap shells','ok':len(caps)==67 and all(p['nonmanifold_edges']==0 for p in planes)})
checks.append({'name':'five row inclinations follow a dip, not a crown','ok':sorted({round(c['top_incline_degrees'],2) for c in caps})==[-2.4,-1.2,0,1.2,2.4]})
row_heights=[]
for row in range(1,6):
    group=[cap for cap in caps if cap.parent.parent['row_profile']==row]
    values=[]
    for cap in group:
        slope=math.tan(math.radians(cap['top_incline_degrees']))
        ids={i for face in cap.data.polygons if face.material_index==1 for i in face.vertices}
        values.append(sum(cap.data.vertices[i].co.z-slope*cap.data.vertices[i].co.y for i in ids)/len(ids))
    row_heights.append(sum(values)/len(values))
drop=(row_heights[0]+row_heights[4])/2-row_heights[2]
checks.append({'name':'middle row is only 0.8 mm lower than both end rows, relative to deck','ok':abs(drop-.8)<.00001 and row_heights[0]>row_heights[1]>row_heights[2]<row_heights[3]<row_heights[4],'measured_center_drop_mm':drop,'row_heights_mm':row_heights})
checks.append({'name':'logo image is packed','ok':all(image.packed_file for image in bpy.data.images if image.source=='FILE')})
body=bpy.data.objects['CNC unibody frame']
checks.append({'name':'body width matches configured reference','ok':abs(body.dimensions.x-330.9)<.01})
floor=body['contact_plane_z_mm'];half=330.9/2
floor_side=[v.co for v in body.data.vertices if abs(abs(v.co.x)-half)<.0001 and abs(v.co.z-floor)<.0001]
flat_run=max(p.y for p in floor_side)-min(p.y for p in floor_side) if floor_side else 0
checks.append({'name':'main side face itself has a horizontal clipped lower section','ok':30<flat_run<45 and min(v.co.z for v in body.data.vertices)>=floor-.0001,'measured_flat_run_mm':flat_run,'contact_plane_z_mm':floor})
bm=bmesh.new();bm.from_mesh(body.data);bad=sum(not edge.is_manifold for edge in bm.edges);bm.free()
checks.append({'name':'clipped unibody remains watertight','ok':bad==0,'nonmanifold_edges':bad})
report={'checks':checks,'caps':planes,'maximum_surface_error_mm':max(p['surface_error_mm'] for p in planes),'passed':all(c['ok'] for c in checks)}
(folder/'geometry-validation.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='caps'},ensure_ascii=True),flush=True)
if not report['passed']:raise RuntimeError('Model validation failed')
