// Web系统巡检助手 - 管理面板
class InspectionPanel {
    constructor() {
        this.currentEditId = null;
        this.currentEditType = null;
        this.autoRefreshInterval = null;
        this.init();
        
        // 自动刷新相关
        this.autoRefreshInterval = null;
        this.startAutoRefresh();
        
        // 监听消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });
        
        // 添加防抖相关属性
        this.updateStatusDebounceTimer = null;
        this.updateStatusDebounceDelay = 1000; // 1秒防抖
    }

    // 初始化
    async init() {
        this.initializeElements();
        this.bindEvents();
        await this.loadData();
        this.startAutoRefresh();
    }

    // 初始化DOM元素
    initializeElements() {
        // 状态指示器
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        
        // 按钮
        this.startInspectionBtn = document.getElementById('startInspectionBtn');
        this.stopInspectionBtn = document.getElementById('stopInspectionBtn');
        this.clearResultsBtn = document.getElementById('clearResultsBtn');
        this.addApiBtn = document.getElementById('addApiBtn');
        this.addPageBtn = document.getElementById('addPageBtn');
        this.exportBtn = document.getElementById('exportBtn');
        
        // 配置列表
        this.apiList = document.getElementById('apiList');
        this.pageList = document.getElementById('pageList');
        
        // 结果显示
        this.totalCount = document.getElementById('totalCount');
        this.successCount = document.getElementById('successCount');
        this.errorCount = document.getElementById('errorCount');
        this.resultsList = document.getElementById('resultsList');
        
        // 模态框
        this.modal = document.getElementById('modal');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalBody = document.getElementById('modalBody');
        this.saveBtn = document.getElementById('saveBtn');
        this.cancelBtn = document.getElementById('cancelBtn');
        
        // 导出模态框
        this.exportModal = document.getElementById('exportModal');
        this.closeExportModal = document.getElementById('closeExportModal');
        this.cancelExportBtn = document.getElementById('cancelExportBtn');
        this.copyReportBtn = document.getElementById('copyReportBtn');
        this.downloadReportBtn = document.getElementById('downloadReportBtn');
        this.includeScreenshots = document.getElementById('includeScreenshots');
        this.includeDetails = document.getElementById('includeDetails');
        this.includeConfig = document.getElementById('includeConfig');
        this.reportPreview = document.getElementById('reportPreview');
        this.copySuccess = document.getElementById('copySuccess');
    }

    // 绑定事件
    bindEvents() {
        // 开始巡检按钮
        this.startInspectionBtn.addEventListener('click', () => {
            this.startInspection();
        });
        
        // 停止巡检按钮
        this.stopInspectionBtn.addEventListener('click', () => {
            this.stopInspection();
        });
        
        // 清除结果按钮
        this.clearResultsBtn.addEventListener('click', () => {
            this.clearResults();
        });
        
        // 添加诊断按钮（如果存在）
        const diagnosticBtn = document.getElementById('diagnosticBtn');
        if (diagnosticBtn) {
            diagnosticBtn.addEventListener('click', () => {
                this.runDiagnostics();
            });
        }
        
        // 添加接口按钮
        this.addApiBtn.addEventListener('click', () => {
            this.showApiModal();
        });
        
        // 添加页面按钮
        this.addPageBtn.addEventListener('click', () => {
            this.showPageModal();
        });
        
        // 导出按钮
        this.exportBtn.addEventListener('click', () => {
            this.showExportModal();
        });
        
        // 模态框相关按钮
        this.cancelBtn.addEventListener('click', () => {
            this.hideModal();
        });
        
        this.saveBtn.addEventListener('click', () => {
            this.saveConfig();
        });
        
        // 导出模态框按钮
        this.closeExportModal.addEventListener('click', () => {
            this.hideExportModal();
        });
        
        this.cancelExportBtn.addEventListener('click', () => {
            this.hideExportModal();
        });
        
        this.copyReportBtn.addEventListener('click', () => {
            this.copyReport();
        });
        
        this.downloadReportBtn.addEventListener('click', () => {
            this.downloadReport();
        });
        
        // 导出选项改变时更新预览
        [this.includeScreenshots, this.includeDetails, this.includeConfig].forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateReportPreview();
            });
        });
        
        // 点击背景关闭模态框
        this.exportModal.addEventListener('click', (e) => {
            if (e.target === this.exportModal) {
                this.hideExportModal();
            }
        });
        
        // 使用事件委托处理动态按钮
        this.apiList.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                const action = e.target.dataset.action;
                const id = e.target.dataset.id;
                
                if (action === 'edit') {
                    this.editApi(id);
                } else if (action === 'delete') {
                    this.deleteApi(id);
                }
            }
        });
        
        this.pageList.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                const action = e.target.dataset.action;
                const id = e.target.dataset.id;
                
                if (action === 'edit') {
                    this.editPage(id);
                } else if (action === 'delete') {
                    this.deletePage(id);
                }
            }
        });
    }

    // 加载数据
    async loadData() {
        try {
            await this.loadConfig();
            await this.loadResults();
            await this.updateStatus();
        } catch (error) {
            console.error('加载数据失败:', error);
        }
    }

    // 加载配置
    async loadConfig() {
        try {
            const result = await chrome.storage.sync.get(['apis', 'pages']);
            
            const apis = result.apis || [];
            this.renderApiList(apis);
            
            const pages = result.pages || [];
            this.renderPageList(pages);
            
        } catch (error) {
            console.error('加载配置失败:', error);
        }
    }

    // 渲染接口列表
    renderApiList(apis) {
        if (apis.length === 0) {
            this.apiList.innerHTML = '<div class="empty-message">暂无接口配置</div>';
            return;
        }

        const html = apis.map(api => `
            <div class="config-item">
                <div class="config-item-info">
                    <div class="config-item-name">${api.name}</div>
                    <div class="config-item-url">${api.method} ${api.url}</div>
                </div>
                <div style="display: flex; gap: 4px;">
                    <button class="btn btn-primary" data-action="edit" data-id="${api.id}" style="padding: 4px 8px; font-size: 12px;">编辑</button>
                    <button class="btn btn-danger" data-action="delete" data-id="${api.id}" style="padding: 4px 8px; font-size: 12px;">删除</button>
                </div>
            </div>
        `).join('');

        this.apiList.innerHTML = html;
    }

    // 渲染页面列表
    renderPageList(pages) {
        if (pages.length === 0) {
            this.pageList.innerHTML = '<div class="empty-message">暂无页面配置</div>';
            return;
        }

        const html = pages.map(page => `
            <div class="config-item">
                <div class="config-item-info">
                    <div class="config-item-name">${page.name}</div>
                    <div class="config-item-url">${page.url}</div>
                </div>
                <div style="display: flex; gap: 4px;">
                    <button class="btn btn-primary" data-action="edit" data-id="${page.id}" style="padding: 4px 8px; font-size: 12px;">编辑</button>
                    <button class="btn btn-danger" data-action="delete" data-id="${page.id}" style="padding: 4px 8px; font-size: 12px;">删除</button>
                </div>
            </div>
        `).join('');

        this.pageList.innerHTML = html;
    }

    // 显示接口配置模态框
    async showApiModal(id = null) {
        this.currentEditId = id;
        this.currentEditType = 'api';
        
        let api = null;
        if (id) {
            const result = await chrome.storage.sync.get(['apis']);
            const apis = result.apis || [];
            api = apis.find(a => a.id === id);
        }

        this.modalTitle.textContent = id ? '编辑接口' : '添加接口';
        this.modalBody.innerHTML = `
            <div class="form-group">
                <label for="apiName">接口名称</label>
                <input type="text" id="apiName" placeholder="请输入接口名称" value="${api?.name || ''}">
            </div>
            <div class="form-group">
                <label for="apiUrl">接口URL</label>
                <input type="url" id="apiUrl" placeholder="https://example.com/api/..." value="${api?.url || ''}">
            </div>
            <div class="form-group">
                <label for="apiMethod">请求方法</label>
                <select id="apiMethod">
                    <option value="GET" ${api?.method === 'GET' ? 'selected' : ''}>GET</option>
                    <option value="POST" ${api?.method === 'POST' ? 'selected' : ''}>POST</option>
                    <option value="PUT" ${api?.method === 'PUT' ? 'selected' : ''}>PUT</option>
                    <option value="DELETE" ${api?.method === 'DELETE' ? 'selected' : ''}>DELETE</option>
                </select>
            </div>
            <div class="form-group">
                <label for="apiAlertRule">告警规则</label>
                <textarea id="apiAlertRule" placeholder="例如: response.code != 0 || response.data.length === 0">${api?.alertRule || ''}</textarea>
                <div class="form-help">支持JavaScript表达式，response变量包含接口返回的JSON数据</div>
            </div>
        `;

        this.showModal();
    }

    // 显示页面配置模态框
    async showPageModal(id = null) {
        this.currentEditId = id;
        this.currentEditType = 'page';
        
        let page = null;
        if (id) {
            const result = await chrome.storage.sync.get(['pages']);
            const pages = result.pages || [];
            page = pages.find(p => p.id === id);
        }

        this.modalTitle.textContent = id ? '编辑页面' : '添加页面';
        this.modalBody.innerHTML = `
            <div class="form-group">
                <label for="pageName">页面名称</label>
                <input type="text" id="pageName" placeholder="请输入页面名称" value="${page?.name || ''}">
            </div>
            <div class="form-group">
                <label for="pageUrl">页面URL</label>
                <input type="url" id="pageUrl" placeholder="https://example.com/page" value="${page?.url || ''}">
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="pageScreenshot" ${page?.screenshot ? 'checked' : ''}>
                    启用页面截图
                </label>
            </div>
        `;

        this.showModal();
    }

    // 显示模态框
    showModal() {
        this.modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    // 隐藏模态框
    hideModal() {
        this.modal.classList.remove('show');
        document.body.style.overflow = 'auto';
        this.currentEditId = null;
        this.currentEditType = null;
    }

    // 保存配置
    async saveConfig() {
        try {
            if (this.currentEditType === 'api') {
                await this.saveApiConfig();
            } else if (this.currentEditType === 'page') {
                await this.savePageConfig();
            }
            
            this.hideModal();
            await this.loadConfig();
            
        } catch (error) {
            console.error('保存配置失败:', error);
            alert('保存配置失败，请重试');
        }
    }

    // 保存接口配置
    async saveApiConfig() {
        const name = document.getElementById('apiName').value.trim();
        const url = document.getElementById('apiUrl').value.trim();
        const method = document.getElementById('apiMethod').value;
        const alertRule = document.getElementById('apiAlertRule').value.trim();

        if (!name || !url) {
            alert('请填写接口名称和URL');
            return;
        }

        const result = await chrome.storage.sync.get(['apis']);
        const apis = result.apis || [];
        
        const apiData = {
            id: this.currentEditId || this.generateId(),
            name,
            url,
            method,
            alertRule
        };

        if (this.currentEditId) {
            const index = apis.findIndex(api => api.id === this.currentEditId);
            if (index !== -1) {
                apis[index] = apiData;
            }
        } else {
            apis.push(apiData);
        }

        await chrome.storage.sync.set({ apis });
    }

    // 保存页面配置
    async savePageConfig() {
        const name = document.getElementById('pageName').value.trim();
        const url = document.getElementById('pageUrl').value.trim();
        const screenshot = document.getElementById('pageScreenshot').checked;

        if (!name || !url) {
            alert('请填写页面名称和URL');
            return;
        }

        const result = await chrome.storage.sync.get(['pages']);
        const pages = result.pages || [];
        
        const pageData = {
            id: this.currentEditId || this.generateId(),
            name,
            url,
            screenshot
        };

        if (this.currentEditId) {
            const index = pages.findIndex(page => page.id === this.currentEditId);
            if (index !== -1) {
                pages[index] = pageData;
            }
        } else {
            pages.push(pageData);
        }

        await chrome.storage.sync.set({ pages });
    }

    // 编辑接口
    async editApi(id) {
        await this.showApiModal(id);
    }

    // 删除接口
    async deleteApi(id) {
        if (confirm('确定要删除此接口配置吗？')) {
            try {
                const result = await chrome.storage.sync.get(['apis']);
                const apis = result.apis || [];
                const updatedApis = apis.filter(api => api.id !== id);
                await chrome.storage.sync.set({ apis: updatedApis });
                await this.loadConfig();
            } catch (error) {
                console.error('删除接口失败:', error);
                alert('删除接口失败，请重试');
            }
        }
    }

    // 编辑页面
    async editPage(id) {
        await this.showPageModal(id);
    }

    // 删除页面
    async deletePage(id) {
        if (confirm('确定要删除此页面配置吗？')) {
            try {
                const result = await chrome.storage.sync.get(['pages']);
                const pages = result.pages || [];
                const updatedPages = pages.filter(page => page.id !== id);
                await chrome.storage.sync.set({ pages: updatedPages });
                await this.loadConfig();
            } catch (error) {
                console.error('删除页面失败:', error);
                alert('删除页面失败，请重试');
            }
        }
    }

    // 开始巡检
    async startInspection() {
        try {
            console.log('[前端] 发送启动巡检消息...');
            
            // 增加超时处理
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('消息发送超时')), 10000);
            });
            
            const sendMessagePromise = chrome.runtime.sendMessage({ action: 'startInspection' });
            
            console.log('[前端] 等待后台响应...');
            const response = await Promise.race([sendMessagePromise, timeoutPromise]);
            
            console.log('[前端] 收到后台响应:', response);
            console.log('[前端] 响应类型:', typeof response);
            console.log('[前端] 响应详情:', JSON.stringify(response, null, 2));
            
            if (!response) {
                console.error('[前端] 响应为空或未定义');
                throw new Error('未收到响应，可能是后台脚本未正常运行');
            }
            
            // 由于后台现在立即发送响应，我们只需要检查响应格式
            if (response.success === true) {
                console.log('[前端] 巡检启动请求已发送');
                console.log('[前端] 等待2秒后更新状态...');
                
                // 等待更长时间让后台完成启动流程
                setTimeout(() => {
                    console.log('[前端] 更新状态...');
                    this.updateStatus();
                }, 2000);
            } else if (response.error) {
                console.error('[前端] 启动巡检失败，后台返回错误:', response.error);
                throw new Error(response.error);
            } else {
                console.warn('[前端] 未知响应格式:', response);
                // 即使格式不匹配，也尝试更新状态
                setTimeout(() => {
                    this.updateStatus();
                }, 2000);
            }
        } catch (error) {
            console.error('[前端] 启动巡检失败:', error);
            console.error('[前端] 错误详情:', {
                message: error.message,
                stack: error.stack,
                name: error.name,
                toString: error.toString()
            });
            
            // 显示更详细的错误信息
            const errorDetails = `
启动巡检失败: ${error.message}

错误类型: ${error.name}
错误时间: ${new Date().toLocaleString()}

请检查:
1. 浏览器扩展是否已启用
2. 控制台是否有其他错误信息
3. 是否配置了巡检项目

如果问题持续，请重新加载扩展或重启浏览器。
            `;
            
            alert(errorDetails);
        }
    }

    // 停止巡检
    async stopInspection() {
        try {
            console.log('发送停止巡检消息...');
            const response = await chrome.runtime.sendMessage({ action: 'stopInspection' });
            console.log('停止巡检响应:', response);
            
            if (!response) {
                throw new Error('未收到响应，可能是后台脚本未正常运行');
            }
            
            if (response.success === true) {
                console.log('巡检停止成功');
                setTimeout(() => this.updateStatus(), 500); // 延迟更新状态
            } else {
                const errorMsg = response.error || '未知停止错误';
                console.error('停止巡检失败，后台返回:', response);
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error('停止巡检失败:', error);
            console.error('错误详情:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            alert('停止巡检失败：' + error.message);
        }
    }

    // 清除结果
    async clearResults() {
        if (confirm('确定要清除所有巡检结果吗？此操作无法撤销。')) {
            try {
                await chrome.storage.local.set({ inspectionResults: [] });
                await this.loadResults();
                alert('巡检结果已清除');
            } catch (error) {
                console.error('清除结果失败:', error);
                alert('清除结果失败，请重试');
            }
        }
    }

    // 检查后台脚本状态
    async checkBackgroundStatus() {
        try {
            console.log('[状态检查] 开始检查后台脚本状态...');
            
            const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
            console.log('[状态检查] 后台脚本状态响应:', response);
            
            if (!response) {
                console.error('[状态检查] 后台脚本无响应');
                return false;
            }
            
            console.log('[状态检查] 后台脚本运行状态:', response.isRunning);
            return true;
        } catch (error) {
            console.error('[状态检查] 后台脚本检查失败:', error);
            return false;
        }
    }

    // 防抖版本的状态更新
    updateStatusDebounced() {
        // 清除之前的定时器
        if (this.updateStatusDebounceTimer) {
            clearTimeout(this.updateStatusDebounceTimer);
        }
        
        // 设置新的定时器
        this.updateStatusDebounceTimer = setTimeout(() => {
            this.updateStatus();
        }, this.updateStatusDebounceDelay);
    }

    // 更新状态
    async updateStatus() {
        try {
            console.log('[状态更新] 开始更新状态...');
            
            // 检查后台脚本状态
            const backgroundActive = await this.checkBackgroundStatus();
            console.log('[状态更新] 后台脚本活跃状态:', backgroundActive);
            
            if (!backgroundActive) {
                console.warn('[状态更新] 后台脚本未响应，设置为错误状态');
                this.statusDot.className = 'status-dot error';
                this.statusText.textContent = '后台脚本未响应';
                this.startInspectionBtn.disabled = true;
                this.stopInspectionBtn.disabled = true;
                return;
            }
            
            // 获取存储的状态
            console.log('[状态更新] 获取存储的状态...');
            const result = await chrome.storage.local.get(['inspectionActive']);
            const isActive = result.inspectionActive || false;
            
            console.log('[状态更新] 存储的巡检状态:', isActive);
            
            if (isActive) {
                console.log('[状态更新] 设置为巡检中状态');
                this.statusDot.className = 'status-dot warning';
                this.statusText.textContent = '巡检中...';
                this.startInspectionBtn.disabled = true;
                this.stopInspectionBtn.disabled = false;
            } else {
                console.log('[状态更新] 设置为就绪状态');
                this.statusDot.className = 'status-dot';
                this.statusText.textContent = '就绪';
                this.startInspectionBtn.disabled = false;
                this.stopInspectionBtn.disabled = true;
            }
            
            console.log('[状态更新] 状态更新完成');
        } catch (error) {
            console.error('[状态更新] 更新状态失败:', error);
            // 设置为错误状态
            this.statusDot.className = 'status-dot error';
            this.statusText.textContent = '状态获取失败';
            this.startInspectionBtn.disabled = true;
            this.stopInspectionBtn.disabled = true;
        }
    }

    // 加载结果
    async loadResults() {
        try {
            const result = await chrome.storage.local.get(['inspectionResults']);
            const results = result.inspectionResults || [];
            
            this.renderResults(results);
            
        } catch (error) {
            console.error('加载结果失败:', error);
        }
    }

    // 渲染结果
    renderResults(results) {
        const totalCount = results.length;
        const successCount = results.filter(r => r.status === 'success').length;
        const errorCount = results.filter(r => r.status === 'error').length;

        // 更新统计信息
        this.totalCount.textContent = totalCount;
        this.successCount.textContent = successCount;
        this.errorCount.textContent = errorCount;

        // 渲染结果列表
        if (results.length === 0) {
            this.resultsList.innerHTML = '<div class="empty-message">暂无巡检结果</div>';
            return;
        }

        const html = results.map(result => `
            <div class="result-item ${result.status}">
                <div class="result-header">
                    <div class="result-name">${result.name}</div>
                    <div class="result-status ${result.status}">${result.status === 'success' ? '成功' : '失败'}</div>
                </div>
                <div class="result-details">
                    <div><strong>URL:</strong> ${result.url}</div>
                    <div><strong>类型:</strong> ${result.type === 'api' ? '接口' : '页面'}</div>
                    <div><strong>耗时:</strong> ${result.duration || 0}ms</div>
                    <div><strong>时间:</strong> ${new Date(result.timestamp).toLocaleString()}</div>
                </div>
                ${result.error ? `<div class="result-error">错误: ${result.error}</div>` : ''}
                ${result.pageInfo && result.pageInfo.errors && result.pageInfo.errors.length > 0 ? 
                    `<div class="result-details">
                        <div><strong>检测到的问题:</strong></div>
                        <ul style="margin: 4px 0; padding-left: 20px; font-size: 12px;">
                            ${result.pageInfo.errors.map(error => `<li>${error}</li>`).join('')}
                        </ul>
                    </div>` : ''}
            </div>
        `).join('');

        this.resultsList.innerHTML = html;
    }

    // 开始自动刷新
    startAutoRefresh() {
        this.autoRefreshInterval = setInterval(() => {
            this.loadResults();
            this.updateStatusDebounced(); // 使用防抖版本
        }, 10000); // 改为10秒刷新一次，减少频率
    }

    // 停止自动刷新
    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }

    // 处理消息
    handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'statusUpdate':
                console.log('[前端] 收到状态更新消息');
                this.updateStatusDebounced(); // 使用防抖版本
                break;
            case 'resultsUpdate':
                console.log('[前端] 收到结果更新消息');
                this.loadResults();
                break;
        }
    }

    // 生成唯一ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // 运行诊断
    async runDiagnostics() {
        console.log('[诊断] 开始运行诊断...');
        
        const diagnosticInfo = {
            timestamp: new Date().toLocaleString(),
            userAgent: navigator.userAgent,
            chromeVersion: navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || '未知',
            extensionId: chrome.runtime.id,
            results: {}
        };
        
        // 测试后台脚本连接
        try {
            console.log('[诊断] 测试后台脚本连接...');
            const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
            diagnosticInfo.results.backgroundConnection = {
                status: 'success',
                response: response,
                connected: true
            };
        } catch (error) {
            diagnosticInfo.results.backgroundConnection = {
                status: 'error',
                error: error.message,
                connected: false
            };
        }
        
        // 检查存储状态
        try {
            console.log('[诊断] 检查存储状态...');
            const storage = await chrome.storage.local.get(['inspectionActive', 'inspectionResults']);
            diagnosticInfo.results.storage = {
                status: 'success',
                inspectionActive: storage.inspectionActive,
                resultsCount: storage.inspectionResults?.length || 0
            };
        } catch (error) {
            diagnosticInfo.results.storage = {
                status: 'error',
                error: error.message
            };
        }
        
        // 检查配置
        try {
            console.log('[诊断] 检查配置...');
            const config = await chrome.storage.sync.get(['apis', 'pages']);
            diagnosticInfo.results.config = {
                status: 'success',
                apiCount: config.apis?.length || 0,
                pageCount: config.pages?.length || 0
            };
        } catch (error) {
            diagnosticInfo.results.config = {
                status: 'error',
                error: error.message
            };
        }
        
        // 检查权限
        try {
            console.log('[诊断] 检查权限...');
            const permissions = await chrome.permissions.getAll();
            diagnosticInfo.results.permissions = {
                status: 'success',
                permissions: permissions
            };
        } catch (error) {
            diagnosticInfo.results.permissions = {
                status: 'error',
                error: error.message
            };
        }
        
        console.log('[诊断] 诊断完成:', diagnosticInfo);
        
        // 显示诊断结果
        const resultText = JSON.stringify(diagnosticInfo, null, 2);
        
        // 创建诊断结果窗口
        const diagWindow = window.open('', '_blank', 'width=800,height=600');
        diagWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>扩展诊断结果</title>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; padding: 20px; }
                    pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow: auto; }
                    .status-success { color: #28a745; }
                    .status-error { color: #dc3545; }
                    button { padding: 10px 20px; margin: 10px 5px; }
                </style>
            </head>
            <body>
                <h2>Web系统巡检助手 - 诊断结果</h2>
                <button onclick="navigator.clipboard.writeText(document.getElementById('diagnostic-data').textContent)">复制诊断信息</button>
                <button onclick="window.close()">关闭</button>
                <pre id="diagnostic-data">${resultText}</pre>
            </body>
            </html>
        `);
        
        console.log('[诊断] 诊断结果已在新窗口中显示');
    }
    
    // 显示导出模态框
    async showExportModal() {
        console.log('[导出] 显示导出模态框');
        
        // 检查是否有结果
        const result = await chrome.storage.local.get(['inspectionResults']);
        const results = result.inspectionResults || [];
        
        if (results.length === 0) {
            alert('没有巡检结果可以导出');
            return;
        }
        
        this.exportModal.style.display = 'block';
        this.updateReportPreview();
    }
    
    // 隐藏导出模态框
    hideExportModal() {
        this.exportModal.style.display = 'none';
    }
    
    // 更新报告预览
    async updateReportPreview() {
        console.log('[导出] 更新报告预览');
        
        const reportHtml = await this.generateReport();
        this.reportPreview.innerHTML = reportHtml;
    }
    
    // 生成报告
    async generateReport() {
        console.log('[导出] 生成报告');
        
        // 获取结果数据
        const result = await chrome.storage.local.get(['inspectionResults']);
        const results = result.inspectionResults || [];
        
        // 获取配置数据（如果需要）
        let configData = {};
        if (this.includeConfig.checked) {
            const config = await chrome.storage.sync.get(['apis', 'pages']);
            configData = config;
        }
        
        // 统计数据
        const totalCount = results.length;
        const successCount = results.filter(r => r.status === 'success').length;
        const errorCount = results.filter(r => r.status === 'error').length;
        
        // 生成报告HTML
        let reportHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
                <h1 style="color: #2c3e50; text-align: center; margin-bottom: 30px;">
                    Web系统巡检报告
                </h1>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                    <h2 style="color: #2c3e50; margin-bottom: 15px;">执行概要</h2>
                    <div style="display: flex; gap: 30px; justify-content: center;">
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: bold; color: #2c3e50;">${totalCount}</div>
                            <div style="font-size: 14px; color: #666;">总计</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: bold; color: #28a745;">${successCount}</div>
                            <div style="font-size: 14px; color: #666;">成功</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${errorCount}</div>
                            <div style="font-size: 14px; color: #666;">失败</div>
                        </div>
                    </div>
                    <div style="margin-top: 15px; text-align: center; font-size: 14px; color: #666;">
                        报告生成时间：${new Date().toLocaleString()}
                    </div>
                </div>
        `;
        
        if (this.includeConfig.checked && (configData.apis?.length > 0 || configData.pages?.length > 0)) {
            reportHtml += `
                <div style="margin-bottom: 30px;">
                    <h2 style="color: #2c3e50; margin-bottom: 15px;">配置信息</h2>
            `;
            
            if (configData.apis?.length > 0) {
                reportHtml += `
                    <h3 style="color: #495057; margin-bottom: 10px;">接口配置 (${configData.apis.length}个)</h3>
                    <div style="margin-bottom: 20px;">
                `;
                configData.apis.forEach(api => {
                    reportHtml += `
                        <div style="border: 1px solid #e9ecef; border-radius: 4px; padding: 10px; margin-bottom: 8px; background-color: #f8f9fa;">
                            <div style="font-weight: bold;">${api.name}</div>
                            <div style="font-size: 12px; color: #666; margin-top: 4px;">${api.method} ${api.url}</div>
                        </div>
                    `;
                });
                reportHtml += `</div>`;
            }
            
            if (configData.pages?.length > 0) {
                reportHtml += `
                    <h3 style="color: #495057; margin-bottom: 10px;">页面配置 (${configData.pages.length}个)</h3>
                    <div style="margin-bottom: 20px;">
                `;
                configData.pages.forEach(page => {
                    reportHtml += `
                        <div style="border: 1px solid #e9ecef; border-radius: 4px; padding: 10px; margin-bottom: 8px; background-color: #f8f9fa;">
                            <div style="font-weight: bold;">${page.name}</div>
                            <div style="font-size: 12px; color: #666; margin-top: 4px;">${page.url}</div>
                        </div>
                    `;
                });
                reportHtml += `</div>`;
            }
            
            reportHtml += `</div>`;
        }
        
        // 详细结果
        reportHtml += `
            <div style="margin-bottom: 30px;">
                <h2 style="color: #2c3e50; margin-bottom: 15px;">详细结果</h2>
        `;
        
        results.forEach(result => {
            const statusColor = result.status === 'success' ? '#28a745' : '#dc3545';
            const statusText = result.status === 'success' ? '成功' : '失败';
            const borderColor = result.status === 'success' ? '#28a745' : '#dc3545';
            
            reportHtml += `
                <div style="border: 1px solid #e9ecef; border-left: 4px solid ${borderColor}; border-radius: 4px; padding: 15px; margin-bottom: 15px; background-color: #f8f9fa;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div style="font-weight: bold; color: #2c3e50;">${result.name}</div>
                        <div style="padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; background-color: ${result.status === 'success' ? '#d4edda' : '#f8d7da'}; color: ${result.status === 'success' ? '#155724' : '#721c24'};">
                            ${statusText}
                        </div>
                    </div>
                    <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                        <div><strong>URL:</strong> ${result.url}</div>
                        <div><strong>类型:</strong> ${result.type === 'api' ? '接口' : '页面'}</div>
                        <div><strong>耗时:</strong> ${result.duration || 0}ms</div>
                        <div><strong>时间:</strong> ${new Date(result.timestamp).toLocaleString()}</div>
                    </div>
            `;
            
            if (result.error && this.includeDetails.checked) {
                reportHtml += `
                    <div style="background-color: #f8d7da; color: #721c24; padding: 8px; border-radius: 4px; margin-top: 8px; font-size: 12px;">
                        <strong>错误信息:</strong> ${result.error}
                    </div>
                `;
            }
            
            if (result.pageInfo && result.pageInfo.errors && result.pageInfo.errors.length > 0 && this.includeDetails.checked) {
                reportHtml += `
                    <div style="margin-top: 8px;">
                        <div style="font-weight: bold; font-size: 12px; color: #2c3e50;">检测到的问题:</div>
                        <ul style="margin: 4px 0; padding-left: 20px; font-size: 12px; color: #666;">
                `;
                result.pageInfo.errors.forEach(error => {
                    reportHtml += `<li>${error}</li>`;
                });
                reportHtml += `</ul></div>`;
            }
            
            if (result.screenshot && this.includeScreenshots.checked) {
                reportHtml += `
                    <div style="margin-top: 10px;">
                        <div style="font-weight: bold; font-size: 12px; color: #2c3e50; margin-bottom: 5px;">页面截图:</div>
                        <img src="${result.screenshot}" style="max-width: 100%; height: auto; border: 1px solid #e9ecef; border-radius: 4px;">
                    </div>
                `;
            }
            
            reportHtml += `</div>`;
        });
        
        reportHtml += `
                </div>
                
                <div style="text-align: center; font-size: 12px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
                    此报告由 Web系统巡检助手 自动生成<br>
                    生成时间：${new Date().toLocaleString()}
                </div>
            </div>
        `;
        
        return reportHtml;
    }
    
    // 复制报告
    async copyReport() {
        console.log('[导出] 复制报告');
        
        try {
            const reportHtml = await this.generateReport();
            
            // 创建临时元素来复制HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = reportHtml;
            document.body.appendChild(tempDiv);
            
            // 选择内容并复制
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(tempDiv);
            selection.removeAllRanges();
            selection.addRange(range);
            
            document.execCommand('copy');
            
            // 清理
            document.body.removeChild(tempDiv);
            selection.removeAllRanges();
            
            // 显示成功提示
            this.showCopySuccess();
            
            console.log('[导出] 报告已复制到剪贴板');
            
        } catch (error) {
            console.error('[导出] 复制报告失败:', error);
            alert('复制报告失败，请重试');
        }
    }
    
    // 下载报告
    async downloadReport() {
        console.log('[导出] 下载报告');
        
        try {
            const reportHtml = await this.generateReport();
            
            // 创建完整的HTML文档
            const fullHtml = `
                <!DOCTYPE html>
                <html lang="zh-CN">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Web系统巡检报告</title>
                    <style>
                        body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
                        @media print {
                            body { padding: 0; }
                        }
                    </style>
                </head>
                <body>
                    ${reportHtml}
                </body>
                </html>
            `;
            
            // 创建下载链接
            const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Web系统巡检报告_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('[导出] 报告下载完成');
            
        } catch (error) {
            console.error('[导出] 下载报告失败:', error);
            alert('下载报告失败，请重试');
        }
    }
    
    // 显示复制成功提示
    showCopySuccess() {
        this.copySuccess.classList.add('show');
        setTimeout(() => {
            this.copySuccess.classList.remove('show');
        }, 3000);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new InspectionPanel();
}); 