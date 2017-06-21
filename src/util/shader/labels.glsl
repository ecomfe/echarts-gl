@export ecgl.labels.vertex

// https://mattdesl.svbtle.com/drawing-lines-is-hard
attribute vec3 position: POSITION;
attribute vec2 texcoord: TEXCOORD_0;
attribute vec2 offset;
#ifdef VERTEX_COLOR
attribute vec4 a_Color : COLOR;
varying vec4 v_Color;
#endif

uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;
uniform vec4 viewport : VIEWPORT;

varying vec2 v_Texcoord;

void main()
{
    vec4 proj = worldViewProjection * vec4(position, 1.0);

    vec2 screen = (proj.xy / abs(proj.w) + 1.0) * 0.5 * viewport.zw;

    screen += offset;

    proj.xy = (screen / viewport.zw - 0.5) * 2.0 * abs(proj.w);
    gl_Position = proj;
#ifdef VERTEX_COLOR
    v_Color = a_Color;
#endif
    v_Texcoord = texcoord;
}
@end


@export ecgl.labels.fragment

uniform vec3 color : [1.0, 1.0, 1.0];
uniform float alpha : 1.0;
uniform sampler2D textureAtlas;
uniform vec2 uvScale: [1.0, 1.0];

#ifdef VERTEX_COLOR
varying vec4 v_Color;
#endif
varying float v_Miter;

varying vec2 v_Texcoord;

void main()
{
    gl_FragColor = vec4(color, alpha) * texture2D(textureAtlas, v_Texcoord * uvScale);
#ifdef VERTEX_COLOR
    gl_FragColor *= v_Color;
#endif
}

@end