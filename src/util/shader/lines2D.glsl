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
attribute vec2 offset;
attribute vec4 a_Color : COLOR;

uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;

varying vec4 v_Color;
varying float v_Miter;

void main()
{
    gl_Position = worldViewProjection * vec4(position + offset, 10.0, 1.0);

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