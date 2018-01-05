@export ecgl.sdfSprite.vertex

uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;
uniform float elapsedTime : 0;

attribute vec3 position : POSITION;

#ifdef VERTEX_SIZE
attribute float size;
#else
uniform float u_Size;
#endif

#ifdef VERTEX_COLOR
attribute vec4 a_FillColor: COLOR;
varying vec4 v_Color;
#endif

#ifdef VERTEX_ANIMATION
attribute vec3 prevPosition;
attribute float prevSize;
uniform float percent : 1.0;
#endif


#ifdef POSITIONTEXTURE_ENABLED
uniform sampler2D positionTexture;
#endif

varying float v_Size;

void main()
{

#ifdef POSITIONTEXTURE_ENABLED
    // Only 2d position texture supported
    gl_Position = worldViewProjection * vec4(texture2D(positionTexture, position.xy).xy, -10.0, 1.0);
#else

    #ifdef VERTEX_ANIMATION
    vec3 pos = mix(prevPosition, position, percent);
    #else
    vec3 pos = position;
    #endif
    gl_Position = worldViewProjection * vec4(pos, 1.0);
#endif

#ifdef VERTEX_SIZE
#ifdef VERTEX_ANIMATION
    v_Size = mix(prevSize, size, percent);
#else
    v_Size = size;
#endif
#else
    v_Size = u_Size;
#endif

#ifdef VERTEX_COLOR
    v_Color = a_FillColor;
    // v_StrokeColor = a_StrokeColor;
#endif

    gl_PointSize = v_Size;
}

@end

@export ecgl.sdfSprite.fragment

uniform vec4 color: [1, 1, 1, 1];
uniform vec4 strokeColor: [1, 1, 1, 1];
uniform float smoothing: 0.07;

uniform float lineWidth: 0.0;

#ifdef VERTEX_COLOR
varying vec4 v_Color;
// varying vec4 v_StrokeColor;
#endif

varying float v_Size;

uniform sampler2D sprite;

@import clay.util.srgb

void main()
{
    gl_FragColor = color;

    vec4 _strokeColor = strokeColor;

#ifdef VERTEX_COLOR
    gl_FragColor *= v_Color;
    // TODO
    // _strokeColor *= v_StrokeColor;
#endif

#ifdef SPRITE_ENABLED
    float d = texture2D(sprite, gl_PointCoord).r;
    // Antialias
    gl_FragColor.a *= smoothstep(0.5 - smoothing, 0.5 + smoothing, d);

    if (lineWidth > 0.0) {
        // TODO SCREEN SPACE OUTLINE
        float sLineWidth = lineWidth / 2.0;

        float outlineMaxValue0 = 0.5 + sLineWidth;
        float outlineMaxValue1 = 0.5 + sLineWidth + smoothing;
        float outlineMinValue0 = 0.5 - sLineWidth - smoothing;
        float outlineMinValue1 = 0.5 - sLineWidth;

        // FIXME Aliasing
        if (d <= outlineMaxValue1 && d >= outlineMinValue0) {
            float a = _strokeColor.a;
            if (d <= outlineMinValue1) {
                a = a * smoothstep(outlineMinValue0, outlineMinValue1, d);
            }
            else {
                a = a * smoothstep(outlineMaxValue1, outlineMaxValue0, d);
            }
            gl_FragColor.rgb = mix(gl_FragColor.rgb * gl_FragColor.a, _strokeColor.rgb, a);
            gl_FragColor.a = gl_FragColor.a * (1.0 - a) + a;
        }
    }
#endif

#ifdef SRGB_DECODE
    gl_FragColor = sRGBToLinear(gl_FragColor);
#endif
}
@end