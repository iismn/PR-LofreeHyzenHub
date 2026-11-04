import * as THREE from './three.module.js';

const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const target=(depth=false)=>new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:depth,stencilBuffer:false});
const material=(uniforms,fragment)=>new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.NoBlending});

// Bloom is extracted from the visible HDR scene, so caps and the housing occlude
// light naturally. No separately positioned glowing strip is drawn below it.
export class KeyboardBloom{
 constructor(renderer){
  this.renderer=renderer;this.base=target(true);this.base.samples=2;
  this.bright=target();this.ping=target();this.tight=target();this.widePing=target();this.soft=target();
  this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));this.quad.frustumCulled=false;this.scene.add(this.quad);
  this.extract=material({image:{value:null}},`uniform sampler2D image;varying vec2 vUv;void main(){vec3 c=texture2D(image,vUv).rgb;float peak=max(max(c.r,c.g),c.b);gl_FragColor=vec4(c*smoothstep(.65,1.35,peak),0.);}`);
  this.blur=material({image:{value:null},stepSize:{value:new THREE.Vector2()}},`uniform sampler2D image;uniform vec2 stepSize;varying vec2 vUv;void main(){vec3 c=texture2D(image,vUv).rgb*.227027;c+=(texture2D(image,vUv+stepSize*1.384615).rgb+texture2D(image,vUv-stepSize*1.384615).rgb)*.316216;c+=(texture2D(image,vUv+stepSize*3.230769).rgb+texture2D(image,vUv-stepSize*3.230769).rgb)*.070270;gl_FragColor=vec4(c,0.);}`);
  this.output=material({image:{value:this.base.texture},tight:{value:this.tight.texture},soft:{value:this.soft.texture},toneMappingExposure:{value:renderer.toneMappingExposure}},`
   uniform sampler2D image;uniform sampler2D tight;uniform sampler2D soft;varying vec2 vUv;
   #include <tonemapping_pars_fragment>
   void main(){
    vec4 base=texture2D(image,vUv);
    vec3 glow=texture2D(tight,vUv).rgb*.55+texture2D(soft,vUv).rgb*.24;
    float energy=max(max(glow.r,glow.g),glow.b);
    float a=base.a+(1.-base.a)*clamp(energy*1.5,0.,.8);
    vec3 straight=(base.rgb+glow)/max(a,.00001);
    vec3 color=sRGBTransferOETF(vec4(ACESFilmicToneMapping(straight),1.)).rgb;
    gl_FragColor=vec4(color*a,a);
   }`);
  this.width=0;this.height=0;this.info={calls:0,triangles:0};
 }
 setSize(width,height){
  width=Math.max(1,Math.round(width));height=Math.max(1,Math.round(height));
  if(width===this.width&&height===this.height)return;
  this.width=width;this.height=height;this.base.setSize(width,height);
  for(const buffer of [this.bright,this.ping,this.tight])buffer.setSize(Math.max(1,Math.round(width/2)),Math.max(1,Math.round(height/2)));
  for(const buffer of [this.widePing,this.soft])buffer.setSize(Math.max(1,Math.round(width/4)),Math.max(1,Math.round(height/4)));
 }
 pass(shader,buffer){this.quad.material=shader;this.renderer.setRenderTarget(buffer);this.renderer.render(this.scene,this.camera);}
 blurPass(input,output,x,y){this.blur.uniforms.image.value=input.texture;this.blur.uniforms.stepSize.value.set(x,y);this.pass(this.blur,output);}
 render(scene,camera){
  const renderer=this.renderer,previous=renderer.getRenderTarget();
  renderer.setRenderTarget(this.base);renderer.render(scene,camera);
  this.info={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
  this.extract.uniforms.image.value=this.base.texture;this.pass(this.extract,this.bright);
  this.blurPass(this.bright,this.ping,1.1/this.bright.width,0);
  this.blurPass(this.ping,this.tight,0,1.1/this.ping.height);
  this.blurPass(this.tight,this.widePing,2.2/this.soft.width,0);
  this.blurPass(this.widePing,this.soft,0,2.2/this.soft.height);
  this.output.uniforms.toneMappingExposure.value=renderer.toneMappingExposure;
  this.pass(this.output,previous);
 }
 dispose(){
  for(const buffer of [this.base,this.bright,this.ping,this.tight,this.widePing,this.soft])buffer.dispose();
  for(const shader of [this.extract,this.blur,this.output])shader.dispose();this.quad.geometry.dispose();
 }
}
