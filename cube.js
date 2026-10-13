/* Learn Angle 今日目標 液態玻璃方塊
   自寫 WebGL 光線步進 圓角玻璃方塊內盛著隨進度上升的液體
   液面永遠保持水平 轉動時會晃動 點一下會濺起漣漪
   GPU 優化 解析法線 只繪製方塊所在區域 閒置時每秒三十格 浮層開啟時暫停
   自動調整解析度與步進次數 仍然太慢時改用平面後備並釋放 GPU 資源 */
(function () {
  "use strict";
  const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  const FRAG = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "uniform vec2 uRes;uniform float uTime;uniform mat3 uInv;uniform vec3 uPos;uniform float uLevel;uniform vec2 uTilt;",
    "uniform vec4 uRip;uniform float uDark;uniform vec3 uLA;uniform vec3 uLB;uniform float uGlow;uniform float uFill;uniform vec3 uBg;",
    "uniform mat3 uRot;uniform float uStepA;uniform float uStepB;",
    "const vec3 B=vec3(0.6);const float RR=0.25;const float WALL=0.075;",
    "float sdRB(vec3 p,vec3 b,float r){vec3 q=abs(p)-b+r;return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0)-r;}",
    "float outer(vec3 p){return sdRB(uInv*(p-uPos),B,RR);}",
    "float cavity(vec3 p){return sdRB(uInv*(p-uPos),B-WALL,RR-WALL*0.7);}",
    "float surf(vec2 xz){",
    "  float h=uLevel+dot(uTilt,xz-uPos.xz);",
    "  h+=0.007*sin(xz.x*6.0+uTime*1.6)*cos(xz.y*5.0-uTime*1.2);",
    "  h+=0.004*sin((xz.x-xz.y)*9.0+uTime*2.1);",
    "  float d=length(xz-uRip.xy);float age=uTime-uRip.z;",
    "  if(age>0.0)h+=uRip.w*exp(-age*1.8)*sin(d*16.0-age*10.0)*exp(-d*2.0);",
    "  return h;}",
    "float liquid(vec3 p){return max(cavity(p),(p.y-surf(p.xz))*0.7);}",
    "vec3 nRB(vec3 pw,vec3 b,float r){vec3 p=uInv*(pw-uPos);vec3 q=abs(p)-b+r;vec3 m=max(q,0.0);vec3 n;",
    "  if(max(q.x,max(q.y,q.z))>0.0)n=m*sign(p);",
    "  else if(q.x>q.y&&q.x>q.z)n=vec3(sign(p.x),0.0,0.0);else if(q.y>q.z)n=vec3(0.0,sign(p.y),0.0);else n=vec3(0.0,0.0,sign(p.z));",
    "  return normalize(uRot*n);}",
    "vec3 nOuter(vec3 p){return nRB(p,B,RR);}",
    "vec3 nCav(vec3 p){return nRB(p,B-WALL,RR-WALL*0.7);}",
    "vec3 nLiq(vec3 p){",
    "  float h=surf(p.xz);float dTop=abs(p.y-h);float dWall=abs(cavity(p));",
    "  if(dWall<dTop)return nCav(p);",
    "  float e=0.004;float hx=surf(p.xz+vec2(e,0.0));float hz=surf(p.xz+vec2(0.0,e));",
    "  return normalize(vec3(h-hx,e,h-hz));}",
    "float rect(vec3 d,vec3 ax,vec3 tu,vec3 tv,vec2 sz,float soft){float c=dot(d,ax);if(c<=0.0)return 0.0;vec3 q=d/c-ax;float u=abs(dot(q,tu)),v=abs(dot(q,tv));return smoothstep(sz.x,sz.x-soft,u)*smoothstep(sz.y,sz.y-soft,v);}",
    "const vec3 A1=vec3(-0.535396,0.759288,0.369910);const vec3 T1=vec3(0.817258,0.576272,0.0);const vec3 B1=vec3(-0.213168,0.302312,-0.929068);",
    "const vec3 A2=vec3(0.959939,0.121255,0.252615);const vec3 T2=vec3(-0.254493,0.0,0.967075);const vec3 B2=vec3(0.117263,-0.992621,0.030859);",
    "const vec3 A3=vec3(0.249377,0.548630,-0.798007);const vec3 W4=vec3(0.665640,-0.499230,0.554700);const vec3 LK=vec3(-0.461266,0.784152,0.415139);",
    "const vec3 CW=vec3(0.0,-0.287348,-0.957826);const vec3 CU=vec3(1.0,0.0,0.0);const vec3 CV=vec3(0.0,0.957826,-0.287348);",
    "float lights(vec3 d){",
    "  float L=rect(d,A1,T1,B1,vec2(0.40,0.26),0.22)*1.35;",
    "  L+=rect(d,A2,T2,B2,vec2(0.06,0.7),0.05);",
    "  float s=max(dot(d,A3),0.0);s*=s;s*=s;L+=s*s*s*0.9;",
    "  return L;}",
    "vec2 slab(vec3 o,vec3 d,vec3 b){vec3 dd=d+vec3(equal(d,vec3(0.0)))*1e-5;vec3 inv=1.0/dd;vec3 t1=(-b-o)*inv;vec3 t2=(b-o)*inv;vec3 mn=min(t1,t2);vec3 mx=max(t1,t2);return vec2(max(max(mn.x,mn.y),mn.z),min(min(mx.x,mx.y),mx.z));}",
    "vec3 envBase(vec3 d){",
    "  vec3 top=mix(vec3(0.80,0.82,0.86),vec3(0.16,0.20,0.27),uDark);",
    "  vec3 hor=mix(vec3(0.64,0.65,0.69),vec3(0.09,0.12,0.17),uDark);",
    "  vec3 bot=mix(vec3(0.47,0.46,0.47),vec3(0.04,0.05,0.07),uDark);",
    "  vec3 c=d.y>0.0?mix(hor,top,pow(d.y,0.6)):mix(hor,bot,pow(-d.y,0.5));",
    "  float w=max(dot(d,W4),0.0);w*=w*w;c+=vec3(1.0,0.93,0.62)*w*w*0.22;",
    "  return c;}",
    "vec3 env(vec3 d){return envBase(d)+lights(d);}",
    "void main(){",
    "  vec2 uv=(gl_FragCoord.xy-0.5*uRes)/uRes.y;",
    "  vec3 ro=vec3(0.0,0.95,3.3);",
    "  vec3 rd=normalize(uv.x*CU+uv.y*CV+1.75*CW);",
    "  vec4 col=vec4(0.0);",
    "  if(rd.y<0.0){",
    "    float tf=(-0.98-ro.y)/rd.y;vec3 pf=ro+rd*tf;vec2 q=pf.xz-uPos.xz;",
    "    vec2 qs=q*vec2(1.0,1.7);",
    "    float win=smoothstep(1.3,1.05,length(qs));",
    "    float sh=exp(-dot(qs,qs)*2.4)*(0.30-uPos.y*0.8)*win;",
    "    col=vec4(0.0,0.0,0.0,sh*mix(0.6,0.9,uDark));",
    "    vec2 cq=(q-vec2(0.22,0.2))*vec2(1.3,2.3);",
    "    float ca=win*exp(-dot(cq,cq)*4.5)*uFill*(0.78+0.22*sin(uTime*1.3+pf.x*9.0)*sin(pf.z*11.0-uTime));",
    "    col.rgb+=mix(uLB,vec3(1.0),0.15)*ca*mix(0.5,0.35,uDark);",
    "  }",
    "  vec2 bx=slab(uInv*(ro-uPos),uInv*rd,B);",
    "  if(bx.y>max(bx.x,0.0)){",
    "    float t=max(bx.x,0.0);float tmax=bx.y+0.002;bool hit=false;",
    "    for(int i=0;i<40;i++){if(float(i)>=uStepA)break;float d=outer(ro+rd*t);if(d<0.0008){hit=true;break;}t+=d;if(t>tmax)break;}",
    "    if(hit){",
    "      vec3 p=ro+rd*t;vec3 n=nOuter(p);",
    "      float cosi=clamp(dot(-rd,n),0.0,1.0);",
    "      float F=0.035+0.965*pow(1.0-cosi,5.0);",
    "      vec3 rf=reflect(rd,n);",
    "      vec3 rd2=refract(rd,n,1.0/1.5);",
    "      vec3 q=p+rd2*0.004;float t2=0.0;",
    "      for(int i=0;i<12;i++){float dc=cavity(q+rd2*t2);if(dc<0.0)break;t2+=max(dc,0.006);}",
    "      vec3 pin=q+rd2*t2;",
    "      vec3 rd3=normalize(mix(rd,rd2,0.4));",
    "      float tExit=slab(uInv*(pin-uPos),uInv*rd3,B-WALL).y;",
    "      float f0=pin.y-surf(pin.xz);float kk=rd3.y-dot(uTilt,rd3.xz);",
    "      float t3=0.0;float state=0.0;vec3 x=pin;",
    "      if(f0<0.0){state=1.0;}else{",
    "        if(kk<-1e-4&&f0/(-kk)<tExit)t3=max(0.0,f0/(-kk)-0.04);else t3=max(0.0,tExit-0.22);",
    "        for(int i=0;i<64;i++){if(float(i)>=uStepB)break;x=pin+rd3*t3;float dc=cavity(x);float dl=max(dc,(x.y-surf(x.xz))*0.7);float dw=-dc;",
    "          if(dl<0.0012){state=1.0;break;}if(dw<0.0012&&t3>0.02){state=2.0;break;}",
    "          t3+=max(min(dl,max(dw,0.004)),0.003);if(t3>tExit+0.05)break;}",
    "      }",
    "      vec3 inner;float innerA;",
    "      if(state>0.5&&state<1.5){",
    "        vec3 nl=nLiq(x);float sh=surf(x.xz);float depth=clamp(sh-x.y,0.0,1.5);",
    "        float topness=smoothstep(0.55,0.9,nl.y);",
    "        vec3 base=mix(uLA,uLB,clamp(1.0-depth*1.35,0.0,1.0));",
    "        vec3 L=LK;",
    "        vec3 c3=base*(0.6+0.4*max(dot(nl,L),0.0));",
    "        c3+=uLB*0.28*exp(-depth*4.0);",
    "        float Fl=0.02+0.98*pow(1.0-clamp(dot(-rd3,nl),0.0,1.0),5.0);",
    "        c3=mix(c3,env(reflect(rd3,nl)),Fl*topness*0.6);",
    "        c3+=pow(max(dot(reflect(-L,nl),-rd3),0.0),90.0)*topness*1.3;",
    "        float men=smoothstep(0.035,0.0,abs(x.y-sh))*smoothstep(0.05,0.0,-cavity(x));",
    "        c3+=men*0.45;",
    "        c3+=uGlow*vec3(1.0,0.9,0.5)*0.3*(0.6+0.4*sin(uTime*3.0+x.y*8.0));",
    "        inner=c3;innerA=0.96;",
    "      }else{",
    "        vec3 nb=nCav(x);float cb=clamp(dot(rd3,nb),0.0,1.0);",
    "        float Fb=0.04+0.96*pow(1.0-cb,5.0);",
    "        vec3 glassTint=mix(vec3(0.95,0.97,0.995),vec3(1.14,1.2,1.3),uDark);",
    "        float lowY=smoothstep(0.2,-0.6,x.y-uPos.y);",
    "        inner=uBg*glassTint*(1.0-0.05*lowY)+envBase(reflect(rd3,-nb))*Fb*0.25+uLB*0.06*uFill*lowY;",
    "        innerA=0.42;",
    "      }",
    "      float thick=WALL/max(cosi,0.15);",
    "      vec3 tint=mix(vec3(1.0),vec3(0.80,0.88,0.97),clamp(thick*4.0,0.0,1.0));",
    "      float edgeA=clamp((thick-WALL)*2.6,0.0,0.5);",
    "      inner*=tint;",
    "      vec3 iri=0.5+0.5*cos(6.2831*(vec3(0.0,0.33,0.67)+cosi*1.4+uTime*0.02));",
    "      vec3 rcol=env(rf)*mix(vec3(1.0),iri,0.32);",
    "      float hl=lights(rf);",
    "      vec3 edgeCol=uBg*mix(vec3(0.74,0.80,0.90),vec3(1.5,1.7,2.0),uDark);",
    "      float hs=hl*(0.12+0.88*F);",
    "      vec3 C=inner*innerA*(1.0-F)+rcol*F*0.75+edgeCol*edgeA+vec3(hs)*1.15;",
    "      float A=clamp(innerA*(1.0-F)+F*0.75+edgeA+hs*0.35,0.0,1.0);",
    "      col=vec4(C,A)+col*(1.0-A);",
    "    }",
    "  }",
    "  gl_FragColor=col;",
    "}"
  ].join("\n");

  const reduce = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const lerp = (a, b, t) => a + (b - a) * t;
  function mul(a, b) {
    const r = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    return r;
  }
  const rx = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
  const ry = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
  const rz = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];

  function mount(stage, canvas, opt) {
    opt = opt || {};
    const api = { setLevel() {}, splash() {}, setDark() {}, pause() {}, suspend() {}, ok: false };
    let gl = null;
    try { gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power", preserveDrawingBuffer: false }); } catch (e) { gl = null; }
    const fb = stage.querySelector(".cf-liquid");
    const fallback = (f) => { stage.classList.add("no-gl"); if (fb) fb.style.setProperty("--lv", String(0.08 + 0.84 * f)); };
    const keepLevel = (f) => { if (fb) fb.style.setProperty("--lv", String(0.08 + 0.84 * f)); };
    if (!gl) { api.setLevel = (f) => fallback(f); fallback(0); return api; }

    function shader(type, src) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    const vs = shader(gl.VERTEX_SHADER, VERT), fs = shader(gl.FRAGMENT_SHADER, FRAG);
    const prog = vs && fs ? gl.createProgram() : null;
    if (prog) { gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); }
    if (!prog || !gl.getProgramParameter(prog, gl.LINK_STATUS)) { api.setLevel = (f) => fallback(f); fallback(0); return api; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    ["uRes", "uTime", "uInv", "uRot", "uPos", "uLevel", "uTilt", "uRip", "uDark", "uLA", "uLB", "uGlow", "uFill", "uBg", "uStepA", "uStepB"].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.DITHER);
    gl.clearColor(0, 0, 0, 0);
    const mInv = new Float32Array(9), mRot = new Float32Array(9);
    api.ok = true;

    /* 狀態 */
    const S = {
      t: 0, fill: 0.0, fillV: 0, fillT: 0.0, done: 0, doneT: 0,
      yaw: 0.62, yawV: 0, userYaw: 0, pitch: 0, pitchV: 0,
      tiltX: 0, tiltZ: 0, tvx: 0, tvz: 0, prevYawRate: 0, prevPitchRate: 0, lastYaw: 0.62, lastPitch: 0,
      rip: [0, 0, -10, 0], dark: document.documentElement.dataset.theme === "dark" ? 1 : 0,
      scale: Math.min(window.devicePixelRatio || 1, 1.5), maxScale: Math.min(window.devicePixelRatio || 1, 2),
      ema: 16, slow: 0, fast: 0, visible: true, dirty: true, raf: 0, timer: 0, last: 0, lastDraw: 0,
      tier: 0, paused: false, suspended: false, dead: false, scissor: null
    };
    const TIERS = [[40, 40], [28, 30], [20, 22]];
    const A = [0.15, 0.34, 0.60], Bc = [0.62, 0.80, 0.97], GA = [0.86, 0.56, 0.10], GB = [1.0, 0.88, 0.46];

    /* 只繪製方塊與地面陰影會出現的矩形區域 其餘像素不送進 GPU */
    const cam = (() => {
      const ro = [0, 0.95, 3.3], ta = [0, -0.04, 0];
      const nz = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
      const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const ww = nz([ta[0] - ro[0], ta[1] - ro[1], ta[2] - ro[2]]), uu = nz(cr(ww, [0, 1, 0])), vv = cr(uu, ww);
      return (P) => { const d = [P[0] - ro[0], P[1] - ro[1], P[2] - ro[2]], z = dot(d, ww); return [1.75 * dot(d, uu) / z, 1.75 * dot(d, vv) / z]; };
    })();
    function scissorRect(w, h) {
      const pts = [];
      /* 方塊外接球的輪廓 上下浮動範圍都算進去 */
      for (let i = 0; i < 18; i++) for (let j = 0; j <= 8; j++) {
        const th = (i / 18) * Math.PI * 2, ph = (j / 8) * Math.PI, r = 0.92;
        for (const cy of [-0.065, 0.005]) pts.push([r * Math.sin(ph) * Math.cos(th), cy + r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)]);
      }
      /* 地面陰影與焦散實際看得見的範圍 */
      for (let i = 0; i < 32; i++) { const th = (i / 32) * Math.PI * 2; pts.push([1.34 * Math.cos(th), -0.98, 0.79 * Math.sin(th)]); }
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      pts.forEach((P) => { const u = cam(P), px = u[0] * h + w / 2, py = u[1] * h + h / 2; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); });
      x0 = Math.max(0, Math.floor(x0) - 2); y0 = Math.max(0, Math.floor(y0) - 2); x1 = Math.min(w, Math.ceil(x1) + 2); y1 = Math.min(h, Math.ceil(y1) + 2);
      return [x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)];
    }
    function resize() {
      const r = stage.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * S.scale)), h = Math.max(1, Math.round(r.height * S.scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h);
        gl.disable(gl.SCISSOR_TEST); gl.clear(gl.COLOR_BUFFER_BIT);
        S.scissor = scissorRect(w, h);
        gl.enable(gl.SCISSOR_TEST); gl.scissor(S.scissor[0], S.scissor[1], S.scissor[2], S.scissor[3]);
      }
      S.dirty = true;
    }
    function release() {
      S.dead = true; cancel(); fallback(S.fillT);
      try { const ext = gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext(); } catch (e) {}
    }

    function frame(now) {
      S.raf = 0;
      if (S.dead || S.paused || S.suspended) return;
      const dt = Math.min(0.05, (now - (S.last || now)) / 1000); S.last = now;
      const animate = !reduce.matches;
      if (animate) S.t += dt;
      /* 效能分級 只在全速播放時量測 先降解析度 再降步進次數 最後改用平面 */
      if (dt > 0 && S.busy) {
        S.ema = lerp(S.ema, dt * 1000, 0.08);
        if (S.ema > 26) {
          if (++S.slow > 40) {
            S.slow = 0;
            if (S.scale > 0.6) { S.scale = Math.max(0.6, S.scale * 0.8); resize(); }
            else if (S.tier < TIERS.length - 1) S.tier++;
            else if (S.ema > 40) { release(); return; }
          }
        } else S.slow = 0;
        if (S.ema < 14 && (S.tier > 0 || S.scale < S.maxScale)) { if (++S.fast > 200) { S.fast = 0; if (S.tier > 0) S.tier--; else { S.scale = Math.min(S.maxScale, S.scale * 1.12); resize(); } } } else S.fast = 0;
      }
      /* 液面彈簧 */
      const kf = 38, cf = 7.5;
      S.fillV += (-kf * (S.fill - S.fillT) - cf * S.fillV) * dt; S.fill += S.fillV * dt;
      S.done = lerp(S.done, S.doneT, Math.min(1, dt * 2.5));
      /* 轉動 慣性與自動擺動 */
      if (!dragging) { S.userYaw += S.yawV * dt; S.yawV *= Math.pow(0.12, dt); S.pitchV += (-30 * S.pitch - 7 * S.pitchV) * dt; S.pitch += S.pitchV * dt; }
      const auto = animate ? Math.sin(S.t * 0.32) * 0.42 + Math.sin(S.t * 0.13) * 0.18 : 0;
      const yaw = 0.62 + auto + S.userYaw, pitch = 0.32 + S.pitch;
      /* 晃動 由角加速度驅動 */
      if (dt > 0) {
        const yr = (yaw - S.lastYaw) / dt, pr = (pitch - S.lastPitch) / dt;
        const ya = (yr - S.prevYawRate) / dt, pa = (pr - S.prevPitchRate) / dt;
        S.prevYawRate = yr; S.prevPitchRate = pr; S.lastYaw = yaw; S.lastPitch = pitch;
        const fx = Math.max(-5, Math.min(5, -ya * 0.0025)), fz = Math.max(-6, Math.min(6, pa * 0.008));
        S.tvx += (-58 * S.tiltX - 3.4 * S.tvx + fx + S.fillV * 0.0) * dt; S.tiltX += S.tvx * dt;
        S.tvz += (-58 * S.tiltZ - 3.4 * S.tvz + fz) * dt; S.tiltZ += S.tvz * dt;
        S.tiltX = Math.max(-0.38, Math.min(0.38, S.tiltX)); S.tiltZ = Math.max(-0.38, Math.min(0.38, S.tiltZ));
      }
      const R = mul(mul(ry(yaw), rx(pitch)), rz(0.1));
      const bob = animate ? Math.sin(S.t * 1.15) * 0.028 : 0;
      const pos = [0, -0.03 + bob, 0];
      const b = 0.6 - 0.075, rr = 0.25 - 0.075 * 0.7;
      const ext = (Math.abs(R[3]) + Math.abs(R[4]) + Math.abs(R[5])) * (b - rr) + rr;
      const fv = 0.07 + 0.83 * Math.max(0, Math.min(1.08, S.fill));
      const level = pos[1] - ext + 2 * ext * fv;

      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime, S.t);
      for (let i = 0; i < 9; i++) mInv[i] = R[i];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) mRot[i * 3 + j] = R[j * 3 + i];
      gl.uniformMatrix3fv(U.uInv, false, mInv);
      gl.uniformMatrix3fv(U.uRot, false, mRot);
      gl.uniform1f(U.uStepA, TIERS[S.tier][0]); gl.uniform1f(U.uStepB, TIERS[S.tier][1]);
      gl.uniform3f(U.uPos, pos[0], pos[1], pos[2]);
      gl.uniform1f(U.uLevel, level);
      gl.uniform2f(U.uTilt, S.tiltX, S.tiltZ);
      gl.uniform4f(U.uRip, S.rip[0], S.rip[1], S.rip[2], S.rip[3]);
      gl.uniform1f(U.uDark, S.dark);
      const d = S.done;
      gl.uniform3f(U.uLA, lerp(A[0], GA[0], d), lerp(A[1], GA[1], d), lerp(A[2], GA[2], d));
      gl.uniform3f(U.uLB, lerp(Bc[0], GB[0], d), lerp(Bc[1], GB[1], d), lerp(Bc[2], GB[2], d));
      gl.uniform1f(U.uGlow, d * (0.6 + 0.4 * Math.sin(S.t * 2.0)));
      gl.uniform1f(U.uFill, Math.max(0.15, Math.min(1, S.fill)));
      if (S.dark) gl.uniform3f(U.uBg, 0.085, 0.115, 0.16); else gl.uniform3f(U.uBg, 0.94, 0.95, 0.965);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      S.dirty = false;
      const settling = Math.abs(S.fill - S.fillT) > 0.001 || Math.abs(S.fillV) > 0.001 || Math.abs(S.yawV) > 0.001 || Math.abs(S.tvx) > 0.002 || Math.abs(S.tvz) > 0.002 || Math.abs(S.pitchV) > 0.002 || Math.abs(S.done - S.doneT) > 0.002 || (S.t - S.rip[2]) < 3;
      S.busy = settling || dragging;
      if (S.visible && !document.hidden && (animate || S.busy)) schedule(!S.busy);
    }
    /* 互動或晃動時全速 閒置的緩慢擺動只需要每秒約三十格 */
    function schedule(idle) {
      if (S.raf || S.timer || S.dead || S.paused || S.suspended) return;
      if (idle) S.timer = setTimeout(() => { S.timer = 0; S.raf = requestAnimationFrame(frame); }, 30);
      else S.raf = requestAnimationFrame(frame);
    }
    function cancel() { if (S.raf) cancelAnimationFrame(S.raf); if (S.timer) clearTimeout(S.timer); S.raf = 0; S.timer = 0; }
    function wake() { if (S.timer) { clearTimeout(S.timer); S.timer = 0; } S.last = performance.now(); schedule(false); }

    /* 互動 拖曳轉動 點擊濺起 */
    let dragging = false, start = null, lastX = 0, lastY = 0, lastT = 0;
    stage.addEventListener("pointerdown", (e) => {
      start = { x: e.clientX, y: e.clientY, id: e.pointerId }; lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
      S.busy = true; wake();
    });
    stage.addEventListener("pointermove", (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!dragging && Math.hypot(dx, dy) > 6) {
        if (e.pointerType === "touch" && Math.abs(dy) > Math.abs(dx) * 1.2) { start = null; return; }
        dragging = true; try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      }
      if (dragging) {
        const now = performance.now(), t = Math.max(8, now - lastT);
        const mx = e.clientX - lastX, my = e.clientY - lastY;
        S.userYaw += mx * 0.012; S.pitch = Math.max(-0.55, Math.min(0.55, S.pitch + my * 0.006));
        S.yawV = lerp(S.yawV, (mx * 0.012) / (t / 1000), 0.5); S.pitchV = 0;
        lastX = e.clientX; lastY = e.clientY; lastT = now; S.busy = true; schedule(false);
      }
    });
    const end = (e) => {
      if (!start) return;
      if (!dragging) {
        const r = stage.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        S.rip = [nx * 0.9, 0.05, S.t, 0.06];
        S.tvx += (Math.random() - 0.5) * 2.4; S.tvz += 1.2;
        if (opt.onTap) opt.onTap();
      }
      dragging = false; start = null; S.busy = true; wake();
    };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", () => { dragging = false; start = null; });

    /* 可見時才繪製 */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((ents) => { S.visible = ents[0].isIntersecting; if (S.visible) wake(); else cancel(); }, { threshold: 0.01 }).observe(stage);
    }
    document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); else cancel(); });
    if ("ResizeObserver" in window) new ResizeObserver(() => { resize(); wake(); }).observe(stage);
    else window.addEventListener("resize", () => { resize(); wake(); });
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); S.dead = true; cancel(); fallback(S.fillT); });
    resize();

    api.setLevel = function (f, o) {
      f = Math.max(0, Math.min(1, Number(f) || 0));
      const rising = f > S.fillT + 0.001;
      S.fillT = f; S.doneT = o && o.done ? 1 : 0;
      if (rising && S.t > 0.2) { S.rip = [(Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.4, S.t, 0.045]; S.tvx += 1.4; }
      keepLevel(f);
      S.busy = true; wake();
    };
    api.splash = function () { S.rip = [0, 0, S.t, 0.07]; S.tvz += 2; S.busy = true; wake(); };
    api.setDark = function (v) { S.dark = v ? 1 : 0; wake(); };
    /* 浮層蓋住時暫停 避免背景模糊每一格重新計算 */
    api.pause = function (v) { S.paused = !!v; if (S.paused) cancel(); else wake(); };
    /* 省電模式 改用平面方塊 */
    api.suspend = function (v) {
      S.suspended = !!v;
      if (S.dead) return;
      stage.classList.toggle("no-gl", S.suspended);
      if (S.suspended) cancel(); else wake();
    };
    S.busy = true;
    schedule(false);
    return api;
  }

  window.GoalCube = { mount };
})();
