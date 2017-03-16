@export ecgl.lines2D.vertex

uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;

attribute vec2 position: POSITION;
attribute vec4 a_Color : COLOR;
varying vec4 v_Color;

#ifdef POSITIONTEXTURE_ENABLED
uniform sampler2D positionTexture;
#endif

void main()
{
    gl_Position = worldViewProjection * vec4(position, -10.0, 1.0);

    v_Color = a_Color;
}

@end

@export ecgl.lines2D.fragment

uniform vec4 color : [1.0, 1.0, 1.0, 1.0];

varying vec4 v_Color;

void main()
{
    gl_FragColor = color * v_Color;
}
@end


@export ecgl.meshLines2D.vertex

// https://mattdesl.svbtle.com/drawing-lines-is-hard
attribute vec2 position: POSITION;
attribute vec2 normal;
attribute float offset;
attribute vec4 a_Color : COLOR;

uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;
uniform vec4 viewport : VIEWPORT;

varying vec4 v_Color;
varying float v_Miter;

void main()
{
    vec4 p2 = worldViewProjection * vec4(position + normal, -10.0, 1.0);
    gl_Position = worldViewProjection * vec4(position, -10.0, 1.0);

    p2.xy /= p2.w;
    gl_Position.xy /= gl_Position.w;

    // Get normal on projection space.
    vec2 N = normalize(p2.xy - gl_Position.xy);
    gl_Position.xy += N * offset / viewport.zw * 2.0;

    gl_Position.xy *= gl_Position.w;

    v_Color = a_Color;
}
@end


@export ecgl.meshLines2D.fragment

uniform vec4 color : [1.0, 1.0, 1.0, 1.0];

varying vec4 v_Color;
varying float v_Miter;

void main()
{
    // TODO Fadeout pixels v_Miter > 1
    gl_FragColor = color * v_Color;
}

@end