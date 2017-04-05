// COMMON SHADERS
// -----------------WIREFRAME -----------
@export ecgl.wireframe.common.vertexHeader

#ifdef WIREFRAME_QUAD
attribute vec4 barycentric;
varying vec4 v_Barycentric;
#elif defined(WIREFRAME_TRIANGLE)
attribute vec3 barycentric;
varying vec3 v_Barycentric;
#endif

@end

@export ecgl.wireframe.common.vertexMain

#if defined(WIREFRAME_QUAD) || defined(WIREFRAME_TRIANGLE)
    v_Barycentric = barycentric;
#endif

@end


@export ecgl.wireframe.common.fragmentHeader

uniform float wireframeLineWidth : 1;
uniform vec3 wireframeLineColor: [0.5, 0.5, 0.5];

#ifdef WIREFRAME_QUAD
varying vec4 v_Barycentric;
float edgeFactor () {
    vec4 d = fwidth(v_Barycentric);
    vec4 a4 = smoothstep(vec4(0.0), d * wireframeLineWidth, v_Barycentric);
    return min(min(min(a4.x, a4.y), a4.z), a4.w);
}
#elif defined(WIREFRAME_TRIANGLE)
varying vec3 v_Barycentric;
float edgeFactor () {
    vec3 d = fwidth(v_Barycentric);
    vec3 a3 = smoothstep(vec3(0.0), d * wireframeLineWidth, v_Barycentric);
    return min(min(a3.x, a3.y), a3.z);
}
#endif

@end


@export ecgl.wireframe.common.fragmentMain

#if defined(WIREFRAME_QUAD) || defined(WIREFRAME_TRIANGLE)
    if (wireframeLineWidth > 0.) {
        vec3 lineColor = wireframeLineColor;
#ifdef SRGB_DECODE
        lineColor = sRGBToLinear(vec4(lineColor, 1.0)).rgb;
#endif

        gl_FragColor.rgb = mix(lineColor, gl_FragColor.rgb, edgeFactor());
    }
#endif
@end

