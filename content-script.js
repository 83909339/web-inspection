// Web系统巡检助手 - 内容脚本
class PageInspector {
    constructor() {
        this.errors = [];
        this.performance = {};
        this.isInspecting = false;
        this.startTime = Date.now();
        this.init();
    }

    // 初始化
    init() {
        // 只在需要时启动监听
        this.setupErrorListeners();
        this.setupPerformanceMonitoring();
        this.setupResourceMonitoring();
        
        // 监听来自background的消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });

        // 页面加载完成后收集信息
        if (document.readyState === 'complete') {
            this.collectInitialInfo();
        } else {
            window.addEventListener('load', () => {
                this.collectInitialInfo();
            });
        }
    }

    // 设置错误监听器
    setupErrorListeners() {
        // 监听JavaScript错误
        window.addEventListener('error', (event) => {
            this.recordError({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error ? event.error.stack : null,
                timestamp: Date.now()
            });
        });

        // 监听Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            this.recordError({
                type: 'promise',
                message: event.reason ? event.reason.toString() : 'Promise rejected',
                stack: event.reason ? event.reason.stack : null,
                timestamp: Date.now()
            });
        });

        // 监听资源加载错误
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.recordError({
                    type: 'resource',
                    message: `资源加载失败: ${event.target.src || event.target.href}`,
                    element: event.target.tagName.toLowerCase(),
                    url: event.target.src || event.target.href,
                    timestamp: Date.now()
                });
            }
        }, true);
    }

    // 设置性能监控
    setupPerformanceMonitoring() {
        // 监听页面加载完成
        window.addEventListener('load', () => {
            setTimeout(() => {
                this.collectPerformanceInfo();
            }, 1000); // 延迟1秒收集，确保所有资源加载完成
        });

        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.collectPerformanceInfo();
            }
        });
    }

    // 设置资源监控
    setupResourceMonitoring() {
        // 监听图片加载
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            if (!img.complete) {
                img.addEventListener('error', (event) => {
                    this.recordError({
                        type: 'image',
                        message: `图片加载失败: ${img.src}`,
                        url: img.src,
                        timestamp: Date.now()
                    });
                });
            }
        });

        // 使用MutationObserver监听动态添加的资源
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.tagName === 'IMG') {
                            this.monitorImage(node);
                        } else if (node.tagName === 'SCRIPT') {
                            this.monitorScript(node);
                        } else if (node.tagName === 'LINK' && node.rel === 'stylesheet') {
                            this.monitorStylesheet(node);
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 监控图片
    monitorImage(img) {
        img.addEventListener('error', () => {
            this.recordError({
                type: 'image',
                message: `图片加载失败: ${img.src}`,
                url: img.src,
                timestamp: Date.now()
            });
        });
    }

    // 监控脚本
    monitorScript(script) {
        if (script.src) {
            script.addEventListener('error', () => {
                this.recordError({
                    type: 'script',
                    message: `脚本加载失败: ${script.src}`,
                    url: script.src,
                    timestamp: Date.now()
                });
            });
        }
    }

    // 监控样式表
    monitorStylesheet(link) {
        if (link.href) {
            link.addEventListener('error', () => {
                this.recordError({
                    type: 'stylesheet',
                    message: `样式表加载失败: ${link.href}`,
                    url: link.href,
                    timestamp: Date.now()
                });
            });
        }
    }

    // 记录错误
    recordError(error) {
        this.errors.push(error);
        
        // 如果错误过多，只保留最新的
        if (this.errors.length > 50) {
            this.errors = this.errors.slice(-50);
        }

        // 发送关键错误到background
        if (error.type === 'javascript' || error.type === 'promise') {
            this.sendErrorToBackground(error);
        }
    }

    // 收集初始信息
    collectInitialInfo() {
        this.collectPerformanceInfo();
        this.checkExistingResources();
    }

    // 收集性能信息
    collectPerformanceInfo() {
        try {
            if (window.performance && window.performance.timing) {
                const timing = window.performance.timing;
                const navigation = window.performance.navigation;
                
                this.performance = {
                    // 页面加载时间
                    loadTime: timing.loadEventEnd - timing.navigationStart,
                    // DOM解析时间
                    domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
                    // 网络时间
                    networkTime: timing.responseEnd - timing.requestStart,
                    // 服务器响应时间
                    serverTime: timing.responseEnd - timing.requestStart,
                    // 页面渲染时间
                    renderTime: timing.loadEventEnd - timing.responseEnd,
                    // 导航类型
                    navigationType: navigation.type,
                    // 重定向次数
                    redirectCount: navigation.redirectCount,
                    // 完整的时间戳
                    timestamps: {
                        navigationStart: timing.navigationStart,
                        domContentLoadedEventEnd: timing.domContentLoadedEventEnd,
                        loadEventEnd: timing.loadEventEnd,
                        responseEnd: timing.responseEnd,
                        requestStart: timing.requestStart
                    }
                };
            }

            // 收集更多性能指标
            if (window.performance && window.performance.getEntriesByType) {
                const paintEntries = window.performance.getEntriesByType('paint');
                paintEntries.forEach(entry => {
                    this.performance[entry.name] = entry.startTime;
                });

                const navigationEntries = window.performance.getEntriesByType('navigation');
                if (navigationEntries.length > 0) {
                    const nav = navigationEntries[0];
                    this.performance.navigationTiming = {
                        dnsLookup: nav.domainLookupEnd - nav.domainLookupStart,
                        tcpConnect: nav.connectEnd - nav.connectStart,
                        serverResponse: nav.responseEnd - nav.responseStart,
                        domProcessing: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart
                    };
                }
            }

            // 收集内存信息（如果支持）
            if (window.performance && window.performance.memory) {
                this.performance.memory = {
                    usedJSHeapSize: window.performance.memory.usedJSHeapSize,
                    totalJSHeapSize: window.performance.memory.totalJSHeapSize,
                    jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit
                };
            }

        } catch (error) {
            console.error('收集性能信息失败:', error);
        }
    }

    // 检查现有资源
    checkExistingResources() {
        // 检查图片
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            if (img.complete && img.naturalWidth === 0) {
                this.recordError({
                    type: 'image',
                    message: `图片加载失败: ${img.src}`,
                    url: img.src,
                    timestamp: Date.now()
                });
            }
        });

        // 检查视频
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
                this.recordError({
                    type: 'video',
                    message: `视频加载失败: ${video.src}`,
                    url: video.src,
                    timestamp: Date.now()
                });
            }
        });

        // 检查样式表
        const links = document.querySelectorAll('link[rel="stylesheet"]');
        links.forEach(link => {
            // 通过创建测试样式来检查是否加载成功
            try {
                const sheet = link.sheet;
                if (sheet && sheet.cssRules) {
                    // 样式表加载成功
                }
            } catch (e) {
                if (e.name === 'SecurityError') {
                    // 跨域样式表，无法访问但可能加载成功
                } else {
                    this.recordError({
                        type: 'stylesheet',
                        message: `样式表加载失败: ${link.href}`,
                        url: link.href,
                        timestamp: Date.now()
                    });
                }
            }
        });
    }

    // 处理消息
    handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'getPageInfo':
                sendResponse(this.getPageInfo());
                break;
            
            case 'startInspection':
                this.startInspection();
                sendResponse({ success: true });
                break;
            
            case 'stopInspection':
                this.stopInspection();
                sendResponse({ success: true });
                break;
            
            case 'clearErrors':
                this.errors = [];
                sendResponse({ success: true });
                break;
            
            default:
                sendResponse({ error: '未知消息类型' });
        }
    }

    // 获取页面信息
    getPageInfo() {
        return {
            url: window.location.href,
            title: document.title,
            errors: this.errors,
            performance: this.performance,
            pageInfo: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform,
                cookieEnabled: navigator.cookieEnabled,
                onLine: navigator.onLine,
                referrer: document.referrer,
                doctype: document.doctype ? document.doctype.name : null,
                characterSet: document.characterSet,
                readyState: document.readyState,
                visibilityState: document.visibilityState
            },
            timestamp: Date.now()
        };
    }

    // 开始巡检
    startInspection() {
        this.isInspecting = true;
        this.errors = [];
        this.startTime = Date.now();
        
        // 重新收集信息
        this.collectInitialInfo();
    }

    // 停止巡检
    stopInspection() {
        this.isInspecting = false;
        
        // 发送最终结果
        this.sendResultToBackground();
    }

    // 发送错误到background
    sendErrorToBackground(error) {
        try {
            chrome.runtime.sendMessage({
                type: 'pageError',
                data: {
                    url: window.location.href,
                    title: document.title,
                    error: error,
                    timestamp: Date.now()
                }
            });
        } catch (e) {
            // 消息发送失败，可能是在非扩展页面
        }
    }

    // 发送结果到background
    sendResultToBackground() {
        try {
            chrome.runtime.sendMessage({
                type: 'pageInspectionResult',
                data: this.getPageInfo()
            });
        } catch (e) {
            // 消息发送失败，可能是在非扩展页面
        }
    }

    // 检查页面健康状态
    checkPageHealth() {
        const health = {
            score: 100,
            issues: [],
            recommendations: []
        };

        // 检查错误数量
        const errorCount = this.errors.length;
        if (errorCount > 0) {
            health.score -= Math.min(errorCount * 5, 30);
            health.issues.push(`发现 ${errorCount} 个错误`);
        }

        // 检查性能
        if (this.performance.loadTime > 5000) {
            health.score -= 20;
            health.issues.push('页面加载时间过长');
            health.recommendations.push('优化页面加载性能');
        }

        if (this.performance.networkTime > 2000) {
            health.score -= 10;
            health.issues.push('网络响应时间过长');
            health.recommendations.push('优化服务器响应时间');
        }

        // 检查内存使用
        if (this.performance.memory && this.performance.memory.usedJSHeapSize > 50 * 1024 * 1024) {
            health.score -= 15;
            health.issues.push('内存使用过高');
            health.recommendations.push('优化内存使用');
        }

        // 检查控制台错误
        const jsErrors = this.errors.filter(e => e.type === 'javascript' || e.type === 'promise');
        if (jsErrors.length > 0) {
            health.score -= 25;
            health.issues.push('存在JavaScript错误');
            health.recommendations.push('修复JavaScript错误');
        }

        // 检查资源加载失败
        const resourceErrors = this.errors.filter(e => ['image', 'script', 'stylesheet'].includes(e.type));
        if (resourceErrors.length > 0) {
            health.score -= 20;
            health.issues.push('存在资源加载失败');
            health.recommendations.push('检查资源路径和可用性');
        }

        health.score = Math.max(0, health.score);
        return health;
    }
}

// 只在顶层窗口中运行
if (window === window.top) {
    // 创建页面检查器实例
    const pageInspector = new PageInspector();
    
    // 导出到全局作用域（用于调试）
    window.pageInspector = pageInspector;
}

// 防止重复加载
if (!window.inspectionContentScriptLoaded) {
    window.inspectionContentScriptLoaded = true;
} 