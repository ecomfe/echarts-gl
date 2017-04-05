@export ecgl.motionBlur.fragment

uniform sampler2D lastFrame;
uniform sampler2D thisFrame;

uniform float percent: 0.7;

varying vec2 v_Texcoord;

void main()
{
    vec4 tex0 = texture2D(lastFrame, v_Texcoord);
    vec4 tex1 = texture2D(thisFrame, v_Texcoord);

    gl_FragColor = tex0 * percent + tex1;
}

@end