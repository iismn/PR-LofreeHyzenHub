"""Photo-based Hyzen exterior study. Blender 4.5+, geometry in millimetres.
Outputs stay in models/review. Does not modify application assets or source.
Run: blender -b --factory-startup --python models/build_hyzen.py -- --render
"""
import bpy, bmesh, json, math, sys
from pathlib import Path
from mathutils import Vector,Matrix
HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
OUT=HERE/'review';OUT.mkdir(exist_ok=True)
ASSETS=ROOT/'source'/'web' if (ROOT/'source'/'web').exists() else HERE/'assets'
LAYOUT=json.loads((HERE/'layout.json').read_text(encoding='utf-8'))
SLOPE=math.tan(math.radians(12));W,D=330.9,130.2
PITCH=19.05
TOP_RISE=0  # Individual key tops stay flat; the FIVE ROWS form the shallow dip.
ROW_CENTER_DROP=.8
DECK=18+D/2*SLOPE
BODY_THICKNESS=25.4
CONTACT_Z=.8
CONTACT_BREAK_Y=(CONTACT_Z-DECK+BODY_THICKNESS)/SLOPE
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=.001
scene.unit_settings.length_unit='MILLIMETERS'
parts=bpy.data.collections.get('Collection');parts.name='HYZEN 67 · exterior'
studio=bpy.data.collections.new('Studio · not part of keyboard');scene.collection.children.link(studio)
root=bpy.data.objects.new('HYZEN67 · Space Gray',None);parts.objects.link(root)
root['reference']='https://lofree.co.jp/products/hyzen-gaming-keyboard'
root['body_width_mm']=W;root['overall_depth_mm']=142.3;root['deck_angle_degrees']=12
root['construction']='Photo-based exterior reconstruction, not manufacturer CAD'

def material(name,color,metal=0,rough=.3,transmission=0,absorption=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
    p=m.node_tree.nodes['Principled BSDF']
    for k,v in [('Base Color',(*color,1)),('Metallic',metal),('Roughness',rough),('Transmission Weight',transmission),('IOR',1.585 if transmission else 1.45)]:p.inputs[k].default_value=v
    if absorption:
        a=m.node_tree.nodes.new('ShaderNodeVolumeAbsorption');a.inputs['Color'].default_value=(.48,.55,.59,1);a.inputs['Density'].default_value=absorption
        m.node_tree.links.new(a.outputs[0],m.node_tree.nodes['Material Output'].inputs['Volume'])
    return m

metal=material('Space Gray · sandblasted anodized aluminium',(.135,.148,.16),.75,.32)
edge=material('Machined metal',(.19,.20,.21),.8,.27)
black=material('Black FR4',(.008,.010,.013),.06,.32)
recess=material('Black recess',(.005,.007,.009),0,.43)
rubber=material('Rubber feet',(.009,.010,.012),0,.78)
pc=material('Smoked PC · clear sloping walls',(.27,.31,.34),0,.18,1,.045)
roofmat=material('Smoked PC · planar inclined top',(.65,.68,.70),0,.16,1,.03)
clear=material('Nexus clear housing',(.92,.96,.99),0,.1,1)
nylon=material('Nexus white nylon',(.64,.67,.67),0,.4)
pom=material('Nexus POM stem',(.68,.70,.70),0,.32)
socketmat=material('Shadowed socket profile',(.025,.03,.035),0,.38)
ink=material('Pad printed legends',(.83,.85,.85),0,.41)
muted=material('Secondary print',(.45,.48,.50),0,.48)
red=material('Red inlay',(.65,.006,.008),0,.28)
diffuse=material('Front light diffuser',(.45,.67,.78),0,.27,.25)
p=diffuse.node_tree.nodes['Principled BSDF'];p.inputs['Emission Color'].default_value=(.27,.54,.72,1);p.inputs['Emission Strength'].default_value=.7
bar_mat=material('F-zone optical strip',(.009,.014,.02),.3,.19)
nodes=metal.node_tree.nodes;noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=1150
bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.014
metal.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);metal.node_tree.links.new(bump.outputs['Normal'],nodes['Principled BSDF'].inputs['Normal'])

def rr(w,d,r,n=6):
    result=[]
    for x,y,a in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180),(w/2-r,-d/2+r,270)]:
        for i in range(n+1):
            t=math.radians(a+90*i/n);result.append((x+r*math.cos(t),y+r*math.sin(t)))
    return result

def mesh(name,vertices,faces,mat,parent=root,smooth=False):
    data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);parts.objects.link(obj);obj.parent=parent
    if mat:data.materials.append(mat)
    for p in data.polygons:p.use_smooth=smooth
    return obj

def loft(name,loops,mat,parent=root,cap=True,plane=False):
    vertices=[(x,y,z+(SLOPE*y if plane else 0)) for w,d,r,z in loops for x,y in rr(w,d,r)]
    n=len(vertices)//len(loops)
    faces=[(a*n+i,a*n+(i+1)%n,(a+1)*n+(i+1)%n,(a+1)*n+i) for a in range(len(loops)-1) for i in range(n)]
    if cap:faces += [tuple(reversed(range(n))),tuple((len(loops)-1)*n+i for i in range(n))]
    return mesh(name,vertices,faces,mat,parent)

def box(name,size,pos,mat,bevel=.12,parent=root):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,0));o=bpy.context.object;o.name=name;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;o.location=pos
    if mat:o.data.materials.append(mat)
    if bevel:
        m=o.modifiers.new('Edge radius','BEVEL');m.width=bevel;m.segments=3
        m=o.modifiers.new('Face normals','WEIGHTED_NORMAL');m.keep_sharp=True
    return o

def cyl(name,r,d,pos,mat,parent=root,axis='Z',bevel=.06):
    bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=r,depth=d);o=bpy.context.object;o.name=name;o.parent=parent;o.location=pos;o.data.materials.append(mat)
    if axis=='X':o.rotation_euler.y=math.pi/2
    if axis=='Y':o.rotation_euler.x=math.pi/2
    for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
    if bevel:
        m=o.modifiers.new('Edge break','BEVEL');m.width=bevel;m.segments=3
        m=o.modifiers.new('Face normals','WEIGHTED_NORMAL');m.keep_sharp=True
    return o

def subtract(obj,cutter):
    bpy.context.view_layer.objects.active=obj;m=obj.modifiers.new('Machined opening','BOOLEAN');m.operation='DIFFERENCE';m.solver='EXACT';m.object=cutter
    bpy.ops.object.modifier_apply(modifier=m.name);bpy.data.objects.remove(cutter,do_unlink=True)

font=bpy.data.fonts.load(str(ASSETS/'Manrope-Regular.ttf'));symbols=bpy.data.fonts.load(str(ASSETS/'Pretendard-Regular.ttf'))
def label(body,pos,size,parent=root,mat=ink,align='CENTER',tilt=0):
    c=bpy.data.curves.new('Print '+body,'FONT');c.body=body;c.size=size;c.align_x=align;c.align_y='CENTER';c.resolution_u=4;c.extrude=.002
    c.font=symbols if any(ch in body for ch in '←→↑↓⌥⌘') else font
    o=bpy.data.objects.new('Print '+body,c);parts.objects.link(o);o.parent=parent;o.location=pos;o.rotation_euler.x=tilt;o.data.materials.append(mat);return o

# The tilted slab itself is clipped by the horizontal contact plane. Its short
# side is a pentagon, not a rectangular plate sitting on an extra triangular side.
body=loft('CNC unibody frame',[(W,D,.23,DECK-BODY_THICKNESS),(W,D,.23,DECK-.1),(W-.2,D-.2,.21,DECK),(306.6,105.6,.95,DECK),(306.6,105.6,.95,DECK-10.7),(306.0,105.0,.85,DECK-BODY_THICKNESS),(W,D,.23,DECK-BODY_THICKNESS)],metal,cap=False,plane=True)
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free()
subtract(body,box('Horizontal contact-plane trim',(1000,1000,200),(0,0,CONTACT_Z-100),None,0))
body['side_profile']='tilted slab clipped flat at the contact plane'
body['contact_plane_z_mm']=CONTACT_Z
body['contact_break_y_mm']=CONTACT_BREAK_Y
body['front_flat_length_mm']=CONTACT_BREAK_Y+D/2
# Recess the underside within that outer outline; no oversized side-support slab.
upper_depth=D/2-CONTACT_BREAK_Y;upper_center=(D/2+CONTACT_BREAK_Y)/2
outer=[(x,y+upper_center,DECK-BODY_THICKNESS+SLOPE*(y+upper_center)) for x,y in rr(W,upper_depth,.23)]
inner_depth=30-CONTACT_BREAK_Y;inner_center=(30+CONTACT_BREAK_Y)/2
inner=[(x,y+inner_center,CONTACT_Z) for x,y in rr(291,inner_depth,.5)]
bm=bmesh.new()
for point in outer+inner:bm.verts.new(point)
bmesh.ops.convex_hull(bm,input=list(bm.verts),use_existing_faces=False)
unused=[vertex for vertex in bm.verts if not vertex.link_faces]
if unused:bmesh.ops.delete(bm,geom=unused,context='VERTS')
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
data=bpy.data.meshes.new('Recessed faceted underside');bm.to_mesh(data);bm.free()
under=bpy.data.objects.new('Angular underside wedge',data);parts.objects.link(under);under.parent=root;under.data.materials.append(metal)
subtract(body,box('Front aperture cutter',(307,7,5.6),(0,-65.2,2),None,.5))
box('Recessed front diffuser',(306,2.4,3.4),(0,-63.7,2.6),diffuse,.35)
plate=box('Recessed FR4 plate',(306.1,104.7,1.2),(0,0,DECK-7.1),black,.25);plate.rotation_euler.x=math.radians(12)
for x in (-129.6,129.6):
    for y in (-57,25):box('Elastomer strip',(24.5,4.9,1.1),(x,y,.27),rubber,.7)
rear_z=DECK-BODY_THICKNESS+SLOPE*(D/2)
phi=math.atan2(rear_z-CONTACT_Z,D/2-30)
normal=Vector((0,-math.sin(phi),math.cos(phi)))
pocket_center=Vector((102,53,CONTACT_Z+(53-30)*math.tan(phi)))
cutter=box('Underside compartment cutter',(66,19,6),pocket_center+normal*1.5,None,1.6);cutter.rotation_euler.x=phi
subtract(under,cutter)
for name,size,offset,mat,bevel in [('Rear inset compartment',(64,17,1.2),Vector((0,0,0)),recess,1.0),('USB-C metal surround',(9.2,3.4,.6),Vector((-21,-2.7,-.55)),edge,1.35),('USB-C dark opening',(7.8,2.4,.63),Vector((-21,-2.7,-.9)),black,.95)]:
    position=pocket_center+normal*4.0+Matrix.Rotation(phi,4,'X').to_3x3()@offset
    o=box(name,size,position,mat,bevel);o.rotation_euler.x=phi

# The Hi-Fi controls project out of the rear wall, not upward from the deck.
cyl('Volume seating collar',13.15,.65,(121,65.38,32.25),recess,axis='Y')
cyl('Volume solid dial',13.05,12.2,(121,71.1,32.25),metal,axis='Y',bevel=.16)
cyl('Wireless selector seating ring',5.9,.65,(77.7,65.35,32.3),recess,axis='Y')
cyl('Wireless selector circular base',5.6,1.15,(77.7,65.95,32.3),metal,axis='Y')
blade=loft('Wireless selector curved paddle',[(7.4,10.3,2,0),(3.9,10.3,1.1,1.9),(2.1,10.3,.45,5.8)],metal)
blade.rotation_euler.x=-math.pi/2;blade.location=(77.7,66.3,32.3)
cyl('Selector red inset',.46,.025,(77.7,71.87,36.3),red,axis='Y',bevel=.008)
for text,x,z in [('vol−',102.8,30.3),('vol+',139.2,30.3),('wls',69.3,36.8),('off',77.7,39),('cab',86.4,36.8)]:
    label(text,(x,65.115,z+2),1.65,mat=muted).rotation_euler.x=math.pi/2
sy=35;sz=DECK+SLOPE*sy-4.6
subtract(body,box('MAG MEC lever notch',(20,14.1,11.5),(-161.4,sy,sz+5),None,.28))
cyl('MAG MEC inner barrel',6.5,18.5,(-157,sy,sz),metal,axis='X')
cyl('MAG MEC outer face',6.45,1.1,(-166.9,sy,sz),metal,axis='X',bevel=.15)
arm=box('MAG MEC lever tab',(5.6,3.7,7),(-164,sy+1.4,sz+7.2),metal,.5);arm.rotation_euler.x=math.radians(-15)
cyl('MAG MEC red tip',.45,.1,(-164,sy+1.4,sz+10.65),red,bevel=.025)
bar=box('F-zone optical panel',(306,8.8,.6),(0,48.6,DECK+SLOPE*48.6+.1),bar_mat,.35);bar.rotation_euler.x=math.radians(12)
for i in range(12):label('F'+str(i+1),(-127.8+i*19.05,48.5,DECK+SLOPE*48.5+.45),2.7,tilt=math.radians(12))
for text,x in [('→',-143.6),('2.4G',104.9),('CAB',120),('BT',132),('—',143.2)]:label(text,(x,48.5,DECK+SLOPE*48.5+.45),1.8,tilt=math.radians(12))

def keycap(w,d,h,angle,parent,space=False):
    """Hollow PC cap with a flat top. Row height and tilt create the profile.

    The user is referring to the five-row arrangement viewed from a short side,
    not to a dip or crown in an individual keycap's typing surface.
    """
    tw,td=w-1.6,d-4.4;t=math.tan(math.radians(angle))
    def roof(x,y):return h+t*y+TOP_RISE*(1-(y/(td/2))**2)
    vertices=[];faces=[];materials=[]
    def loop(w,d,r,z):
        start=len(vertices);points=rr(w,d,r,8)
        vertices.extend((x,y,z(x,y)) for x,y in points);return start,len(points)
    def bridge(a,b,n,mat=0):
        for i in range(n):
            j=(i+1)%n;faces.append((a+i,a+j,b+j,b+i));materials.append(mat)
    outside=[]
    for ww,dd,r,z in [(w,d,.24,0),(w,d,.3,.1),(tw+.28,td+.28,1.10,h-.12),(tw,td,1.13,h)]:
        outside.append(loop(ww,dd,r,lambda x,y,z=z:roof(x,y)-(h-z) if z>.2 else z))
    for f in (.94,.8,.6,.36,.12,.025):outside.append(loop(tw*f,td*f,1.13*f,roof))
    for j in range(len(outside)-1):bridge(outside[j][0],outside[j+1][0],outside[j][1],1 if j>=3 else 0)
    a,n=outside[-1];faces.append(tuple(a+i for i in range(n)));materials.append(1)
    inside=[]
    for f in (.025,.12,.36,.6,.8,.94,1):inside.append(loop((tw-.1)*f,(td-.1)*f,1.02*f,lambda x,y:roof(x,y)-.82))
    inside.append(loop(w-1.65,d-1.65,.23,lambda x,y:.05))
    a,n=inside[0];faces.append(tuple(reversed([a+i for i in range(n)])));materials.append(0)
    for j in range(len(inside)-1):bridge(inside[j][0],inside[j+1][0],n)
    bridge(inside[-1][0],outside[0][0],n)
    obj=mesh('PC keycap · flat typing plane',vertices,faces,pc,parent,True);obj.data.materials.append(roofmat)
    for p,m in zip(obj.data.polygons,materials):
        p.material_index=m
        if m==1:p.use_smooth=True
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    # Analytic normals avoid radial shading artifacts from concentric topology.
    normals=[tuple(value.vector) for value in obj.data.corner_normals]
    for poly in obj.data.polygons:
        inner_roof=all(abs(obj.data.vertices[i].co.z-(roof(*obj.data.vertices[i].co[:2])-.82))<.0001 for i in poly.vertices)
        if poly.material_index!=1 and not inner_roof:continue
        for index in poly.loop_indices:
            y=obj.data.vertices[obj.data.loops[index].vertex_index].co.y
            normal=Vector((0,-(t-2*TOP_RISE*y/(td/2)**2),1)).normalized()
            normals[index]=tuple(-normal if inner_roof else normal)
    obj.data.normals_split_custom_set(normals)
    obj['wall_thickness_mm']=.82;obj['dish_depth_mm']=max(0,-TOP_RISE);obj['top_incline_degrees']=angle;obj['top_rise_mm']=TOP_RISE
    obj['typing_depth_mm']=td;obj['edge_height_mm']=h
    return roof

def plus(r,b):return [(-b,-r),(b,-r),(b,-b),(r,-b),(r,b),(b,b),(b,r),(-b,r),(-b,b),(-r,b),(-r,-b),(-b,-b)]
def socket(parent,z,roof,sx):
    outer,inner=plus(2.25,.92),plus(1.67,.43)
    verts=[(x,y-1,roof(x+sx,y-1)-.79) for x,y in outer+inner]
    mesh('Moulded cross socket edge',verts,[(i,(i+1)%12,(i+1)%12+12,i+12) for i in range(12)],socketmat,parent)
    # The internal tube and shadowed opening are visible through the roof.
    n=48;verts=[]
    for r,h in [(2.7,2.5),(2.7,z),(2.3,z),(2.3,2.5)]:
        verts.extend((r*math.cos(i*2*math.pi/n),r*math.sin(i*2*math.pi/n)-1,h) for i in range(n))
    mesh('Hollow PC stem sleeve',verts,[(layer*n+i,layer*n+(i+1)%n,((layer+1)%4)*n+(i+1)%n,((layer+1)%4)*n+i) for layer in range(4) for i in range(n)],pc,parent,True)

scale=W/954
# Back -> front: the middle row is slightly lower than BOTH end rows.
# Tangent directions follow the same upward-opening profile, not an arch.
heights=[10.4,9.8,9.6,9.8,10.4]
angles=[2.4,1.2,0,-1.2,-2.4]
root['row_center_drop_mm']=ROW_CENTER_DROP
names={'Delete':'DEL','Tab':'tab','CapsLock':'caps','Left-Shift':'shift','Right-Shift':'shift','Left-Ctrl':'ctrl','Left-Win':'⌥ win','Left-Alt':'⌘ alt','Right-Alt':'⌘ alt','Enter':'ENTER','PageUp':'PGUP','PageDown':'PGDN','Ins':'INS','Fn':'FN','Space':''}
units_by_row=[[1]*13+[2,1],[1.5]+[1]*12+[1.5,1],[1.75]+[1]*11+[2.25,1],[2.25]+[1]*10+[1.75,1,1],[1.25,1.25,1.25,6.25,1.25,1.25,1,1,1]]
photo_y=[(329,469),(518,659),(711,852),(902,1040),(1094,1231)]
photo_layout={}
for row,top in enumerate(sorted({float(key['top']) for key in LAYOUT})):
    ordered=sorted([key for key in LAYOUT if float(key['top'])==top],key=lambda key:float(key['left']))
    assert len(ordered)==len(units_by_row[row])
    column=0
    for i,(key,units) in enumerate(zip(ordered,units_by_row[row])):
        if row==4 and i==6:column+=.5  # Physical Fn slider, not a key.
        uv=[(171+column*190.8+13)/3335,photo_y[row][0]/1400,(171+(column+units)*190.8-13)/3335,photo_y[row][1]/1400]
        photo_layout[key['keyCode']]={'column':column,'units':units,'uv':uv}
        column+=units
    assert abs(column-16)<.0001
keys=[]
for ordinal,key in enumerate(LAYOUT):
    reference=photo_layout[key['keyCode']]
    w=reference['units']*PITCH-1.05;d=float(key['height'])*scale/math.cos(math.radians(12))
    x=(reference['column']+reference['units']/2-8)*PITCH
    y=D/2-(float(key['top'])+66+float(key['height'])/2-30)*D/382
    row=max(0,min(4,round((float(key['top'])-29)/56)))
    node=bpy.data.objects.new('Key · '+key['name'],None);parts.objects.link(node);node.parent=root
    node.location=(x,y,DECK+SLOPE*y-2.5);node.rotation_euler.x=math.radians(12)
    node['hyzenKeyCode']=key['keyCode'];node['keyName']=key['name'];node['hyzenOrdinal']=ordinal;node['row_profile']=row+1
    node['width_units']=reference['units'];node['key_width_mm']=w;node['photoUvRect']=reference['uv']
    box('Nexus nylon lower housing',(14.1,14.1,2.7),(0,0,-3),nylon,.3,node)
    loft('Nexus transparent upper housing',[(14,14,.6,-1.7),(12.2,12.2,.7,1.5),(10.3,10.3,.8,2.1)],clear,node)
    cyl('Nexus POM stem',2.85,4,(0,0,2.5),pom,node,bevel=.12)
    box('Nexus stem cross',(4.4,1.2,1.2),(0,0,4.9),pom,.12,node);box('Nexus stem cross',(1.2,4.4,1.2),(0,0,4.9),pom,.12,node)
    cap=bpy.data.objects.new('Keycap · '+key['name'],None);parts.objects.link(cap);cap.parent=node;cap.location=(0,0,-.6)
    roof=keycap(w,d,heights[row],angles[row],cap,key['name']=='Space')
    for sx in ([0] if w<26 else [-w/2+5.5,0,w/2-5.5]):
        boss=bpy.data.objects.new('Socket',None);parts.objects.link(boss);boss.parent=cap;boss.location.x=sx;socket(boss,roof(sx,-1)-.79,roof,sx)
    name=key['name'];tw,td=w-1.6,d-4.4;a=math.radians(angles[row])
    def glyph(text,x,y,size,align='CENTER'):
        # Pad printing follows the row's inclined plane exactly.
        obj=label(text,(x,y,0),size,cap,align=align)
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH')
        for vertex in obj.data.vertices:vertex.co.z+=roof(x+vertex.co.x,y+vertex.co.y)+.025
        obj['printed_legend']=text
    if name=='Backspace':glyph('←',tw/2-1.4,td/2-2.3,4,'RIGHT')
    elif len(name)==2 and name not in names:
        glyph(name[0],0,td/2-2.1,3);glyph(name[1],0,td/2-4.5,2.3)
    else:
        value=names.get(name,name)
        if value:
            if name in ('Enter','Right-Shift','Right-Alt','Fn'):glyph(value,tw/2-1,td/2-2.2,3.1,'RIGHT')
            elif name in names or name=='Esc':glyph(value,-tw/2+1,td/2-2.2,3.4,'LEFT')
            else:glyph(value,0,td/2-2.3,3.7)
    if name in ('W','A','S','D','F','J','Left-Shift','Enter','Space'):
        xx=tw/2-1.8 if name in ('Left-Shift','Enter','Space') else 0;yy=-td/2+1.1
        mark=box('Red inlay' if name in ('W','A','S','D') else 'Tactile mark',(2.6,.52,.14),(xx,yy,roof(xx,yy)+.06),red if name in ('W','A','S','D') else ink,.23,cap);mark.rotation_euler.x=a
    keys.append(node)

tx=(704+40-483)*scale;ty=D/2-(345-30)*D/382;tz=DECK+SLOPE*ty
for name,size,z,mat in [('Fn slider bezel',(9.7,19.1,1),.7,edge),('Fn slider reveal',(8.4,17.9,1),1.2,black),('Fn slider tab',(7,16.1,1.2),1.8,metal)]:
    o=box(name,size,(tx,ty,tz+z),mat,.1);o.rotation_euler.x=math.radians(12)

# Official English wordmark, packed into the .blend. No Chinese lettering.
image=bpy.data.images.load(str(ASSETS/'lofree-logo.png'));image.pack()
logo_mat=bpy.data.materials.new('Official English Lofree marking');logo_mat.use_nodes=True
nodes=logo_mat.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');dark=nodes.new('ShaderNodeBsdfPrincipled')
dark.inputs['Base Color'].default_value=(.004,.005,.006,1);dark.inputs['Roughness'].default_value=.4
tex=nodes.new('ShaderNodeTexImage');tex.image=image;links=logo_mat.node_tree.links
links.new(tex.outputs['Color'],dark.inputs['Base Color']);links.new(tex.outputs['Alpha'],dark.inputs['Alpha']);links.new(dark.outputs[0],out.inputs[0]);logo_mat.surface_render_method='DITHERED'
u=Vector((0,math.cos(math.radians(12)),math.sin(math.radians(12))));v=Vector((0,-math.sin(math.radians(12)),math.cos(math.radians(12))));center=Vector((W/2+.025,25,27.5))
logo=mesh('Right side Lofree wordmark',[center+u*x+v*y for x,y in [(-20,-5.6),(20,-5.6),(20,5.6),(-20,5.6)]],[(0,1,2,3)],logo_mat)
uv=logo.data.uv_layers.new()
for loop,coord in zip(uv.data,[(0,0),(1,0),(1,1),(0,1)]):loop.uv=coord

def move_studio(o):
    for c in list(o.users_collection):c.objects.unlink(o)
    studio.objects.link(o)

ground=box('Studio ground',(2000,2000,2),(0,0,-1.35),material('Studio white',(.75,.75,.75),0,.6),.01,parent=None);move_studio(ground)
for name,pos,power,size in [('Large key softbox',(-160,-250,430),1250000,310),('Rear strip',(-80,220,300),1600000,250),('Right fill',(360,-60,210),700000,230)]:
    light=bpy.data.lights.new(name,'AREA');light.energy=power;light.shape='RECTANGLE';light.size=size*1.5;light.size_y=size*.65;light.specular_factor=.4
    o=bpy.data.objects.new(name,light);studio.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,20))-o.location).to_track_quat('-Z','Y').to_euler()

def camera(name,pos,look,scale,res=(2000,1100)):
    bpy.ops.object.camera_add(location=pos);o=bpy.context.object;o.name=name;move_studio(o)
    o.rotation_euler=(Vector(look)-o.location).to_track_quat('-Z','Y').to_euler();o.data.type='ORTHO';o.data.ortho_scale=scale;o.data.clip_end=5000;o.data.clip_start=.1;o['width']=res[0];o['height']=res[1];return o

cameras=[camera('01 · front three-quarter',(450,-760,600),(0,0,18),375),camera('02 · top',(0,0,650),(0,0,0),365,(2000,1000)),camera('03 · left profile',(-650,0,23),(0,0,23),165,(1800,850)),camera('04 · rear controls',(-380,700,390),(0,25,22),375),camera('05 · keycap detail',(-235,-150,215),(-98,23,36),105,(1800,1100))]
scene.camera=cameras[0];scene.render.engine='CYCLES';scene.cycles.samples=96;scene.cycles.use_denoising=True
scene.cycles.max_bounces=16;scene.cycles.transmission_bounces=12;scene.cycles.transparent_max_bounces=12
scene.render.resolution_x=2000;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.66,.68,.70,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.35
bpy.ops.object.select_all(action='DESELECT')
for o in parts.objects:o.select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.file.pack_all();bpy.context.preferences.filepaths.save_version=0
# Open the file already framed on the keyboard, with the studio hidden in edit views.
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            space=area.spaces.active;space.clip_end=5000
            space.region_3d.view_location=(0,0,23);space.region_3d.view_distance=440
            space.region_3d.view_rotation=cameras[0].rotation_euler.to_quaternion()
            space.region_3d.view_perspective='ORTHO';space.shading.color_type='MATERIAL'
            space.overlay.show_floor=False
for obj in studio.objects:obj.hide_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Hyzen67.blend'),compress=True)
for o in [o for o in parts.objects if o.type=='FONT']:
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
bpy.ops.object.select_all(action='DESELECT')
for o in parts.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'Hyzen67.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False)
report={'blender':bpy.app.version_string,'key_groups':len(keys),'body_width_mm':W,'body_depth_mm':D,'overall_depth_mm':142.3,'deck_angle_degrees':12,'side_profile':'pentagonal; lower front of tilted slab clipped horizontally','contact_plane_z_mm':CONTACT_Z,'contact_break_y_mm':CONTACT_BREAK_Y,'front_flat_length_mm':CONTACT_BREAK_Y+D/2,'cap_top':'flat inclined plane','row_profile':'middle row LOWER, front and back rows higher','row_center_drop_mm':ROW_CENTER_DROP,'row_heights_mm':heights,'row_top_angles_degrees':angles,'app_modified':False,'note':'The row profile is relative to the housing deck. Exterior reconstructed from photographs, not manufacturer CAD.'}
(OUT/'model-info.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('HYZEN_REVIEW_MODEL_READY',flush=True)
if '--render' in sys.argv:
    for i,cam in enumerate(cameras):
        if '--quick' in sys.argv and i!=0:continue
        scene.camera=cam;scene.render.resolution_x=cam['width'];scene.render.resolution_y=cam['height'];scene.render.filepath=str(OUT/('view-'+str(i+1)+'.png'))
        bpy.ops.render.render(write_still=True);print('HYZEN_RENDER_READY',i+1,flush=True)
