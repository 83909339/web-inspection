// Web系统巡检助手 - 弹窗脚本
class InspectionPopup {
    constructor() {
        this.currentTab = 'config';
        this.currentEditId = null;
        this.currentEditType = null;
        this.initializeElements();
        this.bindEvents();
        this.loadData();
    }

    // 初始化DOM元素引用
    initializeElements() {
        // 标签页元素
        this.tabButtons = document.querySelectorAll('.tab-button');
        this.tabContents = document.querySelectorAll('.tab-content');
        
        // 状态指示器
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        
        // 配置管理元素
        this.addApiBtn = document.getElementById('addApiBtn');
        this.addPageBtn = document.getElementById('addPageBtn');
        this.apiList = document.getElementById('apiList');
        this.pageList = document.getElementById('pageList');
        this.intervalSelect = document.getElementById('intervalSelect');
        this.startInspectionBtn = document.getElementById('startInspectionBtn');
        this.stopInspectionBtn = document.getElementById('stopInspectionBtn');
        
        // 快速操作按钮
        this.openPanelBtn = document.getElementById('openPanelBtn');
        
        // 结果展示元素
        this.refreshResultsBtn = document.getElementById('refreshResultsBtn');
        this.clearResultsBtn = document.getElementById('clearResultsBtn');
        this.totalCount = document.getElementById('totalCount');
        this.successCount = document.getElementById('successCount');
        this.errorCount = document.getElementById('errorCount');
        this.resultsList = document.getElementById('resultsList');
        
        // 报告生成元素
        this.generateReportBtn = document.getElementById('generateReportBtn');
        this.includeScreenshot = document.getElementById('includeScreenshot');
        this.includeErrorDetails = document.getElementById('includeErrorDetails');
        this.reportContent = document.getElementById('reportContent');
        this.reportActions = document.getElementById('reportActions');
        this.copyReportBtn = document.getElementById('copyReportBtn');
        this.previewReportBtn = document.getElementById('previewReportBtn');
        
        // 模态框元素
        this.modal = document.getElementById('modal');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalBody = document.getElementById('modalBody');
        this.closeModal = document.getElementById('closeModal');
        this.saveBtn = document.getElementById('saveBtn');
        this.cancelBtn = document.getElementById('cancelBtn');
    }

    // 绑定事件监听器
    bindEvents() {
        // 标签页切换
        this.tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.switchTab(button.dataset.tab);
            });
        });

        // 快速操作按钮
        this.openPanelBtn.addEventListener('click', () => this.openPanel());
        
        // 配置管理按钮
        this.addApiBtn.addEventListener('click', () => this.showApiModal());
        this.addPageBtn.addEventListener('click', () => this.showPageModal());
        this.startInspectionBtn.addEventListener('click', () => this.startInspection());
        this.stopInspectionBtn.addEventListener('click', () => this.stopInspection());
        this.intervalSelect.addEventListener('change', () => this.saveInterval());

        // 结果展示按钮
        this.refreshResultsBtn.addEventListener('click', () => this.loadResults());
        this.clearResultsBtn.addEventListener('click', () => this.clearResults());

        // 报告生成按钮
        this.generateReportBtn.addEventListener('click', () => this.generateReport());
        this.copyReportBtn.addEventListener('click', () => this.copyReport());
        this.previewReportBtn.addEventListener('click', () => this.previewReport());

        // 模态框事件
        this.closeModal.addEventListener('click', () => this.hideModal());
        this.cancelBtn.addEventListener('click', () => this.hideModal());
        this.saveBtn.addEventListener('click', () => this.saveConfig());
        
        // 点击模态框外部关闭
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hideModal();
            }
        });

        // 监听来自background的消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });

        // 为API列表添加事件委托
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

        // 为页面列表添加事件委托
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

    // 加载初始数据
    async loadData() {
        try {
            await this.loadConfig();
            await this.loadResults();
            await this.updateStatus();
        } catch (error) {
            console.error('加载数据失败:', error);
        }
    }

    // 标签页切换
    switchTab(tabName) {
        this.currentTab = tabName;
        
        // 更新标签按钮状态
        this.tabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabName);
        });
        
        // 更新标签内容显示
        this.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });

        // 加载对应标签的数据
        if (tabName === 'results') {
            this.loadResults();
        } else if (tabName === 'config') {
            this.loadConfig();
        }
    }

    // 加载配置
    async loadConfig() {
        try {
            const result = await chrome.storage.sync.get(['apis', 'pages', 'interval']);
            
            // 加载接口配置
            const apis = result.apis || [];
            this.renderApiList(apis);
            
            // 加载页面配置
            const pages = result.pages || [];
            this.renderPageList(pages);
            
            // 加载间隔设置
            const interval = result.interval || 30;
            this.intervalSelect.value = interval;
            
        } catch (error) {
            console.error('加载配置失败:', error);
        }
    }

    // 渲染接口列表
    renderApiList(apis) {
        if (apis.length === 0) {
            this.apiList.innerHTML = '<p class="empty-message">暂无接口配置</p>';
            return;
        }

        const html = apis.map(api => `
            <div class="config-item" data-id="${api.id}">
                <div class="config-item-info">
                    <div class="config-item-name">${api.name}</div>
                    <div class="config-item-url">${api.method} ${api.url}</div>
                </div>
                <div class="config-item-actions">
                    <button class="btn btn-secondary" data-action="edit" data-id="${api.id}">编辑</button>
                    <button class="btn btn-warning" data-action="delete" data-id="${api.id}">删除</button>
                </div>
            </div>
        `).join('');

        this.apiList.innerHTML = html;
    }

    // 渲染页面列表
    renderPageList(pages) {
        if (pages.length === 0) {
            this.pageList.innerHTML = '<p class="empty-message">暂无页面配置</p>';
            return;
        }

        const html = pages.map(page => `
            <div class="config-item" data-id="${page.id}">
                <div class="config-item-info">
                    <div class="config-item-name">${page.name}</div>
                    <div class="config-item-url">${page.url}</div>
                </div>
                <div class="config-item-actions">
                    <button class="btn btn-secondary" data-action="edit" data-id="${page.id}">编辑</button>
                    <button class="btn btn-warning" data-action="delete" data-id="${page.id}">删除</button>
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
            // 编辑模式
            const index = apis.findIndex(api => api.id === this.currentEditId);
            if (index !== -1) {
                apis[index] = apiData;
            }
        } else {
            // 新增模式
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
            // 编辑模式
            const index = pages.findIndex(page => page.id === this.currentEditId);
            if (index !== -1) {
                pages[index] = pageData;
            }
        } else {
            // 新增模式
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
        if (!confirm('确定要删除这个接口配置吗？')) {
            return;
        }

        try {
            const result = await chrome.storage.sync.get(['apis']);
            const apis = result.apis || [];
            const filteredApis = apis.filter(api => api.id !== id);
            
            await chrome.storage.sync.set({ apis: filteredApis });
            await this.loadConfig();
            
        } catch (error) {
            console.error('删除接口失败:', error);
        }
    }

    // 编辑页面
    async editPage(id) {
        await this.showPageModal(id);
    }

    // 删除页面
    async deletePage(id) {
        if (!confirm('确定要删除这个页面配置吗？')) {
            return;
        }

        try {
            const result = await chrome.storage.sync.get(['pages']);
            const pages = result.pages || [];
            const filteredPages = pages.filter(page => page.id !== id);
            
            await chrome.storage.sync.set({ pages: filteredPages });
            await this.loadConfig();
            
        } catch (error) {
            console.error('删除页面失败:', error);
        }
    }

    // 保存间隔设置
    async saveInterval() {
        const interval = parseInt(this.intervalSelect.value);
        await chrome.storage.sync.set({ interval });
        
        // 通知background更新定时器
        chrome.runtime.sendMessage({ type: 'updateInterval', interval });
    }

    // 开始巡检
    async startInspection() {
        chrome.runtime.sendMessage({ type: 'startInspection' });
        this.updateStatus();
    }

    // 停止巡检
    async stopInspection() {
        chrome.runtime.sendMessage({ type: 'stopInspection' });
        this.updateStatus();
    }

    // 更新状态
    async updateStatus() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'getStatus' });
            
            if (response.isRunning) {
                this.statusDot.className = 'status-dot';
                this.statusText.textContent = '巡检中';
                this.startInspectionBtn.disabled = true;
                this.stopInspectionBtn.disabled = false;
            } else {
                this.statusDot.className = 'status-dot';
                this.statusText.textContent = '已停止';
                this.startInspectionBtn.disabled = false;
                this.stopInspectionBtn.disabled = true;
            }
            
        } catch (error) {
            console.error('更新状态失败:', error);
            this.statusDot.className = 'status-dot error';
            this.statusText.textContent = '错误';
        }
    }

    // 加载巡检结果
    async loadResults() {
        try {
            const result = await chrome.storage.local.get(['inspectionResults']);
            const results = result.inspectionResults || [];
            
            this.renderResults(results);
            
        } catch (error) {
            console.error('加载结果失败:', error);
        }
    }

    // 清除巡检结果
    async clearResults() {
        try {
            // 确认对话框
            const confirmed = confirm('确定要清除所有巡检结果吗？此操作无法撤销。');
            if (!confirmed) {
                return;
            }

            // 清除存储中的数据
            await chrome.storage.local.set({ inspectionResults: [] });
            
            // 更新UI显示
            this.renderResults([]);
            
            // 显示成功消息
            alert('巡检结果已清除');
            
        } catch (error) {
            console.error('清除结果失败:', error);
            alert('清除结果失败，请重试');
        }
    }

    // 渲染巡检结果
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
            this.resultsList.innerHTML = '<p class="empty-message">暂无巡检结果</p>';
            return;
        }

        const html = results.map(result => `
            <div class="result-item">
                <div class="result-item-header">
                    <div class="result-item-name">${result.name}</div>
                    <div class="result-status ${result.status}">${result.status === 'success' ? '成功' : '失败'}</div>
                </div>
                <div class="result-item-details">
                    <div class="result-item-url">${result.url}</div>
                    <div>耗时: ${result.duration || 0}ms</div>
                    <div>时间: ${new Date(result.timestamp).toLocaleString()}</div>
                    ${result.type === 'page' ? `<div>类型: 页面巡检</div>` : `<div>类型: 接口巡检</div>`}
                </div>
                ${result.error ? `<div class="result-item-error">错误: ${result.error}</div>` : ''}
                ${result.pageInfo && result.pageInfo.errors && result.pageInfo.errors.length > 0 ? 
                    `<div class="result-item-details">
                        <div>检测到的问题:</div>
                        <ul style="margin: 4px 0; padding-left: 20px; font-size: 11px;">
                            ${result.pageInfo.errors.map(error => `<li>${error}</li>`).join('')}
                        </ul>
                    </div>` : ''}
            </div>
        `).join('');

        this.resultsList.innerHTML = html;
    }

    // 生成报告
    async generateReport() {
        try {
            const result = await chrome.storage.local.get(['inspectionResults']);
            const results = result.inspectionResults || [];
            
            if (results.length === 0) {
                alert('暂无巡检结果，无法生成报告');
                return;
            }

            const includeScreenshot = this.includeScreenshot.checked;
            const includeErrorDetails = this.includeErrorDetails.checked;
            
            const reportHtml = this.generateReportHtml(results, includeScreenshot, includeErrorDetails);
            
            this.reportContent.innerHTML = reportHtml;
            this.reportActions.style.display = 'flex';
            
        } catch (error) {
            console.error('生成报告失败:', error);
            alert('生成报告失败，请重试');
        }
    }

    // 生成报告HTML
    generateReportHtml(results, includeScreenshot, includeErrorDetails) {
        const now = new Date();
        const reportDate = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
        
        let html = `
            <h2>巡检报告 - ${reportDate}</h2>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>类型</th>
                        <th>名称</th>
                        <th>URL</th>
                        <th>状态</th>
                        <th>耗时(ms)</th>
                        <th>时间</th>
                        ${includeErrorDetails ? '<th>错误详情</th>' : ''}
                        ${includeScreenshot ? '<th>截图</th>' : ''}
                    </tr>
                </thead>
                <tbody>
        `;

        results.forEach(result => {
            const status = result.status === 'success' ? '成功' : '失败';
            const statusClass = result.status === 'success' ? 'success' : 'error';
            const time = new Date(result.timestamp).toLocaleString();
            
            html += `
                <tr>
                    <td>${result.type === 'api' ? '接口' : '页面'}</td>
                    <td>${result.name}</td>
                    <td>${result.url}</td>
                    <td class="${statusClass}">${status}</td>
                    <td>${result.duration || '-'}</td>
                    <td>${time}</td>
                    ${includeErrorDetails ? `<td>${result.error || '-'}</td>` : ''}
                    ${includeScreenshot ? `<td>${result.screenshot ? `<img src="${result.screenshot}" alt="截图">` : '-'}</td>` : ''}
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        return html;
    }

    // 复制报告
    async copyReport() {
        try {
            const reportHtml = this.reportContent.innerHTML;
            
            // 使用Clipboard API复制HTML
            const blob = new Blob([reportHtml], { type: 'text/html' });
            const data = [new ClipboardItem({ 'text/html': blob })];
            
            await navigator.clipboard.write(data);
            alert('报告已复制到剪贴板，可直接粘贴到Word文档中');
            
        } catch (error) {
            console.error('复制报告失败:', error);
            
            // 降级方案：复制纯文本
            try {
                const textContent = this.reportContent.innerText;
                await navigator.clipboard.writeText(textContent);
                alert('报告已复制到剪贴板（纯文本格式）');
            } catch (textError) {
                console.error('复制纯文本失败:', textError);
                alert('复制失败，请手动选择并复制报告内容');
            }
        }
    }

    // 预览报告
    previewReport() {
        const reportHtml = this.reportContent.innerHTML;
        const newWindow = window.open('', '_blank');
        newWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>巡检报告预览</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .success { color: green; }
                    .error { color: red; }
                    img { max-width: 200px; height: auto; }
                </style>
            </head>
            <body>
                ${reportHtml}
            </body>
            </html>
        `);
        newWindow.document.close();
    }

    // 处理来自background的消息
    handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'statusUpdate':
                this.updateStatus();
                break;
            case 'resultsUpdate':
                this.loadResults();
                break;
        }
    }

    // 打开管理面板
    openPanel() {
        chrome.tabs.create({
            url: chrome.runtime.getURL('inspection-panel.html')
        });
    }

    // 生成唯一ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// 初始化popup
document.addEventListener('DOMContentLoaded', () => {
    new InspectionPopup();
}); 