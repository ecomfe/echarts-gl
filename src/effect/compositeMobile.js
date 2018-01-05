export default {
    'type' : 'compositor',
    'nodes' : [
        {
            'name': 'source',
            'type': 'texture',
            'outputs': {
                'color': {}
            }
        },

        {
            'name': 'source_half',
            'shader': '#source(clay.compositor.downsample)',
            'inputs': {
                'texture': 'source'
            },
            'outputs': {
                'color': {
                    'parameters': {
                        'width': 'expr(width * dpr / 2)',
                        'height': 'expr(height * dpr / 2)',
                        'type': 'HALF_FLOAT'
                    }
                }
            },
            'parameters' : {
                'textureSize': 'expr( [width * dpr, height * dpr] )'
            }
        },

        {
            'name': 'source_quad',
            'shader': '#source(clay.compositor.downsample)',
            'inputs': {
                'texture': 'source_half'
            },
            'outputs': {
                'color': {
                    'parameters': {
                        'width': 'expr(width * dpr / 4)',
                        'height': 'expr(height * dpr / 4)',
                        'type': 'HALF_FLOAT'
                    }
                }
            },
            'parameters' : {
                'textureSize': 'expr( [width * dpr / 2, height * dpr / 2] )'
            }
        },


        {
            'name' : 'bright_quad',
            'shader' : '#source(clay.compositor.bright)',
            'inputs' : {
                'texture' : 'source_quad'
            },
            'outputs' : {
                'color' : {
                    'parameters' : {
                        'width' : 'expr(width * dpr / 4)',
                        'height' : 'expr(height * dpr / 4)',
                        'type': 'HALF_FLOAT'
                    }
                }
            },
            'parameters' : {
                'threshold': 3,
                'scale': 4,
                'textureSize': 'expr([width * dpr / 4, height * dpr / 4])'
            },
            'defines': {
                'ANTI_FLICKER': null
            }
        },

        {
            'name' : 'bright2',
            'shader' : '#source(clay.compositor.bright)',
            'inputs' : {
                'texture': 'source_quad'
            },
            'outputs' : {
                'color' : {
                    'parameters' : {
                        'width' : 'expr(width * dpr / 4)',
                        'height' : 'expr(height * dpr / 4)',
                        'type': 'HALF_FLOAT'
                    }
                }
            },
            'parameters' : {
                'threshold': 8,
                'scale': 0.01
            }
        },

        {
            'name': 'bright_downsample_8',
            'shader' : '#source(clay.compositor.downsample)',
            'inputs' : {
                'texture' : 'bright_quad'
            },
            'outputs' : {
                'color' : {
                    'parameters' : {
                        'width' : 'expr(width * dpr / 8)',
                        'height' : 'expr(height * dpr / 8)',
                        'type': 'HALF_FLOAT'
                    }
                }
            },
            'parameters' : {
                'textureSize': 'expr( [width * dpr / 4, height * dpr / 4] )'
            }
        },
        {
            'name': 'bright_downsample_16',
            'shader' : '#source(clay.compositor.downsample)',
            'inputs' : {
                'texture' : 'bright_downsample_8'
            },
            'outputs' : {
                'color' : {
                    'parameters' : {
                        'width' : 'expr(width * dpr / 16)',
                        'height' : 'expr(height * dpr / 16)',
                        'type': 'HALF_FLOAT'
                    }
                }
            },
            'parameters' : {
                'textureSize': 'expr( [width * dpr / 8, height * dpr / 8] )'
            }
        },
        {
            'name': 'bright_downsample_32',
            'shader' : '#source(clay.compositor.downsample)',
            'inputs' : {
                'texture' : 'bright_downsample_16'
            },
            'outputs' : {
                'color' : {
                    'parameters' : {
                        'width' : 'expr(width * dpr / 32)',
                        'height' : 'expr(height * dpr / 32)',
                        'type': 'HALF_FLOAT'
                    }
                }
            },
            'parameters' : {
                'textureSize': 'expr( [width * dpr / 16, height * dpr / 16] )'
            }
        },


        {
            'name' : 'bright_upsample_16_blur_h',
            'shader' : '#source(clay.compositor.gaussian_blur)',
            'inputs' : {
                'texture' : 'bright_downsample_32'
            },
            'outputs' : {
                'color' : {
                    'parameters' : {
                        'width' : 'expr(width * dpr / 16)',
                        'height' : 'expr(height * dpr / 16)',
                        'type': 'HALF_FLOAT'
                    }
                }
            },
            'parameters' : {
                'blurSize' : 1,
                'blurDir': 0.0,
                'textureSize': 'expr( [width * dpr / 32, height * dpr / 32] )'
            }
        },
        {
            'name' : 'bright_upsample_16_blur_v',
            'shader' : '#source(clay.compositor.gaussian_blur)',
            'inputs' : {
                'texture' : 'bright_upsample_16_blur_h'
            },
            'outputs' : {
                'color' : {
                    'parameters' : {
                        'width' : 'expr(width * dpr / 16)',
                        'height' : 'expr(height * dpr / 16)',
                        'type': 'HALF_FLOAT'
                    }
                }
            },
            'parameters' : {
                'blurSize' : 1,
                'blurDir': 1.0,
                'textureSize': 'expr( [width * dpr / 32, height * dpr / 32] )'
            }
        },



        {
            'name' : 'bright_upsample_8_blur_h',
            'shader' : '#source(clay.compositor.gaussian_blur)',
            'inputs' : {
                'texture' : 'bright_downsample_16'
            },
            'outputs' : {
                'color' : {
                    'parameters' : {
                        'width' : 'expr(width * dpr / 8)',
                        'height' : 'expr(height * dpr / 8)',
                        'type': 'HALF_FLOAT'
                    }
                }
            },
            'parameters' : {
                'blurSize' : 1,
                'blurDir': 0.0,
                'textureSize': 'expr( [width * dpr / 16, height * dpr / 16] )'
            }
        },
        {
            'name' : 'bright_upsample_8_blur_v',
            'shader' : '#source(clay.compositor.gaussian_blur)',
            'inputs' : {
                'texture' : 'bright_upsample_8_blur_h'
            },
            'outputs' : {
                'color' : {
                    'parameters' : {
                        'width' : 'expr(width * dpr / 8)',
                        'height' : 'expr(height * dpr / 8)',
                        'type': 'HALF_FLOAT'
                    }
                }
            },
            'parameters' : {
                'blurSize' : 1,
                'blurDir': 1.0,
                'textureSize': 'expr( [width * dpr / 16, height * dpr / 16] )'
            }
        },
        {
            'name' : 'bright_upsample_8_blend',
            'shader' : '#source(clay.compositor.blend)',
            'inputs' : {
                'texture1' : 'bright_upsample_8_blur_v',
                'texture2' : 'bright_upsample_16_blur_v'
            },
            'outputs' : {
                'color' : {
                    'parameters' : {
                        'width' : 'expr(width * dpr / 8)',
                        'height' : 'expr(height * dpr / 8)',
                        'type': 'HALF_FLOAT'
                    }
                }
            },
            'parameters' : {
                'weight1' : 0.3,
                'weight2' : 0.7
            }
        },


        {
            'name' : 'bright_upsample_4_blur_h',
            'shader' : '#source(clay.compositor.gaussian_blur)',
            'inputs' : {
                'texture' : 'bright_downsample_8'
            },
            'outputs' : {
                'color' : {
                    'parameters' : {
                        'width' : 'expr(width * dpr / 4)',
                        'height' : 'expr(height * dpr / 4)',
                        'type': 'HALF_FLOAT'
                    }
                }
            },
            'parameters' : {
                'blurSize' : 1,
                'blurDir': 0.0,
                'textureSize': 'expr( [width * dpr / 8, height * dpr / 8] )'
            }
        },
        {
            'name' : 'bright_upsample_4_blur_v',
            'shader' : '#source(clay.compositor.gaussian_blur)',
            'inputs' : {
                'texture' : 'bright_upsample_4_blur_h'
            },
            'outputs' : {
                'color' : {
                    'parameters' : {
                        'width' : 'expr(width * dpr / 4)',
                        'height' : 'expr(height * dpr / 4)',
                        'type': 'HALF_FLOAT'
                    }
                }
            },
            'parameters' : {
                'blurSize' : 1,
                'blurDir': 1.0,
                'textureSize': 'expr( [width * dpr / 8, height * dpr / 8] )'
            }
        },
        {
            'name' : 'bloom_composite',
            'shader' : '#source(clay.compositor.blend)',
            'inputs' : {
                'texture1' : 'bright_upsample_4_blur_v',
                'texture2' : 'bright_upsample_8_blend'
            },
            'outputs' : {
                'color' : {
                    'parameters' : {
                        'width' : 'expr(width * dpr / 4)',
                        'height' : 'expr(height * dpr / 4)',
                        'type': 'HALF_FLOAT'
                    }
                }
            },
            'parameters' : {
                'weight1' : 0.3,
                'weight2' : 0.7
            }
        },

        {
            'name': 'coc',
            'shader': '#source(ecgl.dof.coc)',
            'outputs': {
                'color': {
                    'parameters': {
                        'minFilter': 'NEAREST',
                        'magFilter': 'NEAREST',
                        'width': 'expr(width * 1.0)',
                        'height': 'expr(height * 1.0)'
                    }
                }
            },
            'parameters': {
                'focalDist': 50,
                'focalRange': 30
            }
        },

        {
            'name': 'dof_far_blur',
            'shader': '#source(ecgl.dof.diskBlur)',
            'inputs': {
                'texture': 'source',
                'coc': 'coc'
            },
            'outputs': {
                'color': {
                    'parameters': {
                        'width': 'expr(width * 1.0)',
                        'height': 'expr(height * 1.0)',
                        'type': 'HALF_FLOAT'
                    }
                }
            },
            'parameters': {
                'textureSize': 'expr( [width * 1.0, height * 1.0] )'
            }
        },
        {
            'name': 'dof_near_blur',
            'shader': '#source(ecgl.dof.diskBlur)',
            'inputs': {
                'texture': 'source',
                'coc': 'coc'
            },
            'outputs': {
                'color': {
                    'parameters': {
                        'width': 'expr(width * 1.0)',
                        'height': 'expr(height * 1.0)',
                        'type': 'HALF_FLOAT'
                    }
                }
            },
            'parameters': {
                'textureSize': 'expr( [width * 1.0, height * 1.0] )'
            },
            'defines': {
                'BLUR_NEARFIELD': null
            }
        },


        {
            'name': 'dof_coc_blur',
            'shader': '#source(ecgl.dof.diskBlur)',
            'inputs': {
                'texture': 'coc'
            },
            'outputs': {
                'color': {
                    'parameters': {
                        'minFilter': 'NEAREST',
                        'magFilter': 'NEAREST',
                        'width': 'expr(width * 1.0)',
                        'height': 'expr(height * 1.0)'
                    }
                }
            },
            'parameters': {
                'textureSize': 'expr( [width * 1.0, height * 1.0] )'
            },
            'defines': {
                'BLUR_COC': null
            }
        },

        {
            'name': 'dof_composite',
            'shader': '#source(ecgl.dof.composite)',
            'inputs': {
                'original': 'source',
                'blurred': 'dof_far_blur',
                'nearfield': 'dof_near_blur',
                'coc': 'coc',
                'nearcoc': 'dof_coc_blur'
            },
            'outputs': {
                'color': {
                    'parameters': {
                        'width': 'expr(width * 1.0)',
                        'height': 'expr(height * 1.0)',
                        'type': 'HALF_FLOAT'
                    }
                }
            }
        },

        {
            'name' : 'composite',
            'shader' : '#source(clay.compositor.hdr.composite)',
            'inputs' : {
                'texture' : 'source',
                'bloom' : 'bloom_composite'
            },
            'outputs' : {
                'color' : {
                    'parameters' : {
                        'width' : 'expr(width)',
                        'height' : 'expr(height)'
                    }
                }
            }
        },
        {
            'name' : 'FXAA',
            'shader' : '#source(clay.compositor.fxaa3)',
            'inputs' : {
                'texture' : 'composite'
            }
        }
    ]
}