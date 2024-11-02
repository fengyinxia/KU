window.alipanArtPlugins =
  window.alipanArtPlugins ||
  (function () {
    var e = {
      version: "1.0.2",
      
      // 初始化入口
      init: (t) => {
        // 确保所有依赖加载完成
        return Promise.all([
          e.readyHls(),
          e.readyArtplayer(),
          e.readyM3u8Parser(),
        ])
        .then(() => e.initArtplayer(t))
        .catch(error => {
          console.error('初始化失败:', error);
          alert('播放器初始化失败，请刷新重试');
          return Promise.reject(error);
        });
      },

      // 加载依赖库
      readyHls: function () {
        return window.Hls || unsafeWindow.Hls
          ? Promise.resolve()
          : e.loadJs("https://unpkg.com/hls.js@1.4.12/dist/hls.min.js");
      },

      readyArtplayer: function () {
        return window.Artplayer || unsafeWindow.Artplayer
          ? Promise.resolve()
          : e.loadJs("https://unpkg.com/artplayer@5.0.9/dist/artplayer.js");
      },

      readyM3u8Parser: function () {
        return window.m3u8Parser || unsafeWindow.m3u8Parser
          ? Promise.resolve()
          : e.loadJs("https://unpkg.com/m3u8-parser@7.1.0/dist/m3u8-parser.min.js");
      },

      // 工具函数
      loadJs: function (t) {
        if (!window.instances) window.instances = {};
        
        if (!window.instances[t]) {
          window.instances[t] = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = t;
            script.type = "text/javascript";
            
            script.onload = resolve;
            script.onerror = () => {
              reject(new Error(`Failed to load script: ${t}`));
            };
            
            document.head.appendChild(script);
          });
        }
        
        return window.instances[t];
      },
      // 初始化播放器
      initArtplayer: function (n) {
        try {
          n = e.initOption(n);
          
          // 验证播放源
          if (!Array.isArray(n.quality) || !n.quality.find(t => t?.url)) {
            throw new Error("No available playUrl");
          }

          const Artplayer = window.Artplayer || unsafeWindow.Artplayer;
          
          // 设置播放器默认选项
          Object.assign(Artplayer, {
            PLAYBACK_RATE: [0.5, 0.75, 1, 1.25, 1.5, 2],
            ASPECT_RATIO: ["default", "4:3", "16:9"],
          });

          // 创建播放器实例
          const art = new Artplayer(n, (art) => {
            // 注册插件
            plugins.forEach(plugin => {
              try {
                art.plugins.add(plugin());
              } catch (error) {
                console.warn('Plugin initialization failed:', error);
              }
            });
          });

          return Promise.resolve(art);
        } catch (error) {
          console.error("播放器初始化失败:", error);
          alert("获取播放信息失败，请刷新重试");
          return Promise.reject(error);
        }
      },

      // 初始化播放器配置
      initOption: function (t) {
        // 基础配置
        const defaultConfig = {
          container: "#artplayer",
          url: "",
          quality: [],
          type: "hls",
          autoplay: true,
          autoPlayback: true,
          aspectRatio: true,
          playbackRate: true,
          setting: true,
          hotkey: true,
          pip: true,
          fullscreen: true,
          fullscreenWeb: true,
          subtitle: {
            url: "",
            type: "vtt",
            style: { 
              color: "#fe9200", 
              fontSize: "25px" 
            },
            encoding: "utf-8",
          },
          subtitleOffset: true,
          icons: {
            loading: '<img src="https://artplayer.org/assets/img/ploading.gif">',
            state: '<img width="150" heigth="150" src="https://artplayer.org/assets/img/state.svg">',
            indicator: '<img width="16" heigth="16" src="https://artplayer.org/assets/img/indicator.svg">',
          },
          contextmenu: [
            {
              html: "检查更新",
              click: function (contextmenu) {
                window.open("https://scriptcat.org/zh-CN/script-show-page/162", "_blank");
                contextmenu.show = false;
              },
            }
          ],
          customType: {
            hls: function (video, url, art) {
              const Hls = window.Hls || unsafeWindow.Hls;
              if (Hls.isSupported()) {
                // 清理旧的 hls 实例
                if (art.hls) {
                  art.hls.destroy();
                }

                const hls = new Hls({
                  maxBufferLength: 60,
                  maxMaxBufferLength: 60,
                });

                hls.loadSource(url);
                hls.attachMedia(video);
                art.hls = hls;

                art.on("destroy", () => hls.destroy());
              } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
                video.src = url;
              } else {
                art.notice.show = "不支持的播放格式: m3u8";
              }
            },
          },
        };

        // 解析视频信息
        const { video_info: videoInfo, video_file: videoFile, video_items: playlistItems } = t || {};
        const { 
          live_transcoding_subtitle_task_list: subtitleList,
          live_transcoding_task_list: qualityList,
          quick_video_list: quickVideoList,
        } = videoInfo?.video_preview_play_info || {};

        // 设置文件ID
        if (videoFile?.file_id) {
          Object.assign(defaultConfig, { 
            file: videoFile, 
            id: videoFile.file_id 
          });
        }

        // 处理视频质量选项
        const qualities = quickVideoList || qualityList || [];
        if (Array.isArray(qualities) && qualities.length) {
          const qualityLabels = {
            QHD: "2K 超清",
            FHD: "1080 全高清",
            HD: "720 高清",
            SD: "540 标清",
            LD: "360 流畅",
          };

          qualities.forEach(quality => {
            Object.assign(quality, {
              html: qualityLabels[quality.template_id] + (quality.url ? "" : "（VIP）"),
              type: "hls",
            });
          });

          // 按分辨率排序
          qualities.sort((a, b) => b.template_height - a.template_height);
          
          // 设置默认质量
          const availableQuality = qualities.find(q => q.url);
          if (availableQuality) {
            availableQuality.default = true;
            Object.assign(defaultConfig, {
              quality: qualities,
              url: availableQuality.url,
              type: availableQuality.type,
            });
          }
        }
            return e;
  })([
    // HLS 事件处理插件
    function () {
      return (art) => {
        const Hls = window.Hls || unsafeWindow.Hls;
        const { hls, option, notice } = art;
        
        if (!hls) return { name: 'hlsevents' };

        // 记录重试次数
        let retryCount = 0;
        const MAX_RETRIES = 3;

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                notice.show = `网络错误，正在重试 (${retryCount + 1}/${MAX_RETRIES})`;
                
                // 处理不同类型的网络错误
                if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
                    data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
                    data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
                  
                  if (retryCount < MAX_RETRIES) {
                    retryCount++;
                    hls.loadSource(hls.url);
                  } else {
                    notice.show = '视频加载失败，请刷新重试';
                    hls.destroy();
                  }
                } else {
                  hls.startLoad();
                }
                break;

              case Hls.ErrorTypes.MEDIA_ERROR:
                notice.show = '正在尝试恢复播放';
                hls.recoverMediaError();
                break;

              default:
                notice.show = '播放器出现错误，请刷新重试';
                hls.destroy();
                break;
            }
          }
        });

        // 清理事件监听
        art.on('destroy', () => {
          hls.off(Hls.Events.ERROR);
        });

        return { name: 'hlsevents' };
      };
    },

    // 画质切换插件
    function () {
      return (art) => {
        const { controls, option, notice } = art;

        function updateQualityControl() {
          // 获取当前默认或第一个可用画质
          const defaultQuality = option.quality?.find(q => q.default) || 
                               option.quality?.find(q => q.url) ||
                               option.quality?.[0];
          
          if (!defaultQuality) return;

          controls.update({
            name: 'quality',
            html: defaultQuality.html || '',
            position: 'right',
            selector: option.quality,
            onSelect: function (item) {
              if (!item.url) {
                notice.show = '该画质不可用';
                return item.html;
              }

              art.switchQuality(item.url)
                .then(() => {
                  notice.show = `已切换至: ${item.html}`;
                  item.default = true;
                })
                .catch(() => {
                  notice.show = '画质切换失败';
                });

              return item.html;
            },
          });
        }

        // 初始化画质控制
        if (option.quality?.length) {
          updateQualityControl();
        }

        // 监听相关事件
        art.on('quality', updateQualityControl);
        art.on('playlist-switch-can', updateQualityControl);

        return { name: 'quality' };
      };
    },

    // 播放列表插件
    function () {
      return (art) => {
        const { controls, option, notice } = art;
        
        if (!option.playlist?.length) {
          return { name: 'playlist' };
        }

        let currentIndex = option.playlist.findIndex(item => item.default);

        function switchVideo(index) {
          const video = option.playlist[index];
          if (!video) {
            notice.show = '视频不存在';
            return;
          }

          option.file = video;
          art.emit('playlist-switch-start', video);
          currentIndex = index;
        }

        // 添加播放列表控制
        controls.add({
          name: 'playlist',
          html: '播放列表',
          position: 'right',
          style: {
            padding: '0 10px',
            minWidth: '80px',
          },
          selector: option.playlist.map((item, index) => ({
            html: item.name || `视频 ${index + 1}`,
            index: index,
            default: currentIndex === index
          })),
          onSelect: (item) => {
            switchVideo(item.index);
            return '播放列表';
          }
        });

        // 自动播放下一集
        art.on('video:ended', () => {
          if (art.storage.get('auto-next') && currentIndex < option.playlist.length - 1) {
            switchVideo(currentIndex + 1);
          }
        });

        return { name: 'playlist' };
      };
    },

    // 字幕插件
    function () {
      return (art) => {
        const { setting, option, subtitle, notice } = art;

        if (!option.subtitlelist?.length) {
          return { name: 'subtitle' };
        }

        // 字幕设置菜单
        setting.add({
          name: 'subtitle',
          html: '字幕设置',
          width: 250,
          selector: [
            {
              html: '字幕选择',
              selector: option.subtitlelist,
              onSelect: (item) => {
                subtitle.switch(item.url)
                  .then(() => {
                    notice.show = `已切换至: ${item.html}`;
                  })
                  .catch(() => {
                    notice.show = '字幕加载失败';
                  });
                return item.html;
              }
            },
            {
              html: '字幕偏移',
              name: 'offset',
              tooltip: '0s',
              range: [-5, 5, 0.1],
              value: 0,
              onRange: (value) => {
                subtitle.offset = value;
                return value + 's';
              }
            },
            {
              html: '字幕大小',
              name: 'scale',
              tooltip: '1',
              range: [0.5, 2, 0.1],
              value: 1,
              onRange: (value) => {
                subtitle.style({ transform: `scale(${value})` });
                return value + 'x';
              }
            }
          ]
        });

        // 加载默认字幕
        art.on('ready', () => {
          const defaultSubtitle = option.subtitlelist.find(sub => sub.default);
          if (defaultSubtitle) {
            subtitle.switch(defaultSubtitle.url)
              .catch(() => console.warn('默认字幕加载失败'));
          }
        });

        return { name: 'subtitle' };
      };
    },

    // 特效字幕插件
    function () {
      return (art) => {
        const { subtitle, template } = art;

        // 处理 ASS/SSA 字幕显示切换
        art.on('subtitle', (show) => {
          if (!art.libass) return;

          template.$subtitle.style.display = show ? 'none' : 'block';
          art.libass.canvasParent.style.display = show ? 'block' : 'none';
          
          if (show) {
            art.libass.resize();
          }
        });

        // 清理资源
        art.on('destroy', () => {
          if (art.libass) {
            art.libass.destroy?.();
            art.libass = null;
          }
        });

        return { name: 'libass' };
      };
    }
  ]);
