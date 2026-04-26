/**
 * 超星自动评教助手 - 评教入口页面脚本
 * 在教师列表页面添加批量评教功能
 */

(function() {
    'use strict';

    // 批量评教状态
    let isBatchRunning = false;
    let pendingTeachers = [];
    let currentIndex = 0;

    /**
     * 解析教师列表，找出未评教的教师
     */
    function parseTeacherList() {
        const teachers = [];
        const rows = document.querySelectorAll('.el-table__row');
        
        rows.forEach(row => {
            // 获取教师姓名
            const nameCell = row.querySelector('.el-table_1_column_1');
            const teacherName = nameCell ? nameCell.textContent.trim() : '';
            
            // 获取评价状态
            const statusCell = row.querySelector('.el-table_1_column_8');
            const statusText = statusCell ? statusCell.textContent.trim() : '';
            
            // 检查是否为未评状态
            const isUnrated = statusText.includes('未评');
            
            // 获取评价按钮
            const actionCell = row.querySelector('.el-table_1_column_9');
            const evaluateBtn = actionCell ? actionCell.querySelector('a.d_button_text') : null;
            
            if (isUnrated && evaluateBtn) {
                teachers.push({
                    name: teacherName,
                    button: evaluateBtn,
                    row: row
                });
            }
        });
        
        return teachers;
    }

    /**
     * 创建批量评教控制面板
     */
    function createBatchPanel() {
        if (document.getElementById('auto-evaluate-batch-panel')) {
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'auto-evaluate-batch-panel';
        panel.innerHTML = `
            <div class="batch-panel-header">
                <span>🚀 批量自动评教</span>
                <button class="batch-toggle-btn" title="最小化">−</button>
            </div>
            <div class="batch-panel-body">
                <div class="batch-info">
                    <div class="batch-status">
                        <span class="status-label">状态:</span>
                        <span id="batch-status-text" class="status-value">就绪</span>
                    </div>
                    <div class="batch-progress">
                        <span class="progress-label">进度:</span>
                        <span id="batch-progress-text" class="progress-value">0/0</span>
                    </div>
                    <div class="batch-current" id="batch-current-teacher" style="display:none;">
                        <span class="current-label">当前:</span>
                        <span id="current-teacher-name" class="current-value">-</span>
                    </div>
                </div>
                <div class="batch-progress-bar">
                    <div id="batch-progress-fill" class="progress-fill" style="width: 0%"></div>
                </div>
                <div class="batch-buttons">
                    <button id="btn-start-batch" class="batch-btn primary">
                        <span>▶</span> 开始全部评教
                    </button>
                    <button id="btn-stop-batch" class="batch-btn danger" style="display:none;">
                        <span>■</span> 停止
                    </button>
                </div>
                <div class="batch-options">
                    <label class="batch-checkbox">
                        <input type="checkbox" id="auto-delay-check" checked>
                        <span>评教间隔延时(3秒)</span>
                    </label>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // 绑定事件
        const startBtn = document.getElementById('btn-start-batch');
        const stopBtn = document.getElementById('btn-stop-batch');
        const toggleBtn = panel.querySelector('.batch-toggle-btn');
        const body = panel.querySelector('.batch-panel-body');

        startBtn.addEventListener('click', startBatchEvaluation);
        stopBtn.addEventListener('click', stopBatchEvaluation);

        // 最小化功能
        let isMinimized = false;
        toggleBtn.addEventListener('click', () => {
            isMinimized = !isMinimized;
            body.style.display = isMinimized ? 'none' : 'block';
            toggleBtn.textContent = isMinimized ? '+' : '−';
        });

        // 使面板可拖动
        makeDraggable(panel);

        // 更新未评教师数量
        updateTeacherCount();
    }

    /**
     * 更新教师数量显示
     */
    function updateTeacherCount() {
        const teachers = parseTeacherList();
        const progressText = document.getElementById('batch-progress-text');
        if (progressText) {
            progressText.textContent = `0/${teachers.length}`;
        }
        return teachers;
    }

    /**
     * 开始批量评教
     */
    async function startBatchEvaluation() {
        if (isBatchRunning) return;

        pendingTeachers = parseTeacherList();
        if (pendingTeachers.length === 0) {
            showBatchNotification('没有需要评教的教师', 'warning');
            return;
        }

        isBatchRunning = true;
        currentIndex = 0;

        // 更新UI
        document.getElementById('btn-start-batch').style.display = 'none';
        document.getElementById('btn-stop-batch').style.display = 'flex';
        document.getElementById('batch-status-text').textContent = '进行中...';
        document.getElementById('batch-status-text').className = 'status-value running';
        document.getElementById('batch-current-teacher').style.display = 'block';

        // 保存状态到background
        chrome.runtime.sendMessage({
            action: 'startBatch',
            totalTeachers: pendingTeachers.length
        });

        showBatchNotification(`开始批量评教，共 ${pendingTeachers.length} 位教师`, 'success');

        // 开始评教流程
        processNextTeacher();
    }

    /**
     * 停止批量评教
     */
    function stopBatchEvaluation() {
        isBatchRunning = false;
        
        document.getElementById('btn-start-batch').style.display = 'flex';
        document.getElementById('btn-stop-batch').style.display = 'none';
        document.getElementById('batch-status-text').textContent = '已停止';
        document.getElementById('batch-status-text').className = 'status-value stopped';
        document.getElementById('batch-current-teacher').style.display = 'none';

        chrome.runtime.sendMessage({ action: 'stopBatch' });
        showBatchNotification('批量评教已停止', 'warning');
    }

    /**
     * 处理下一个教师
     */
    async function processNextTeacher() {
        if (!isBatchRunning || currentIndex >= pendingTeachers.length) {
            finishBatch();
            return;
        }

        const teacher = pendingTeachers[currentIndex];
        
        // 更新当前教师显示
        document.getElementById('current-teacher-name').textContent = teacher.name;
        chrome.runtime.sendMessage({
            action: 'setCurrentTeacher',
            teacherName: teacher.name
        });

        // 更新进度
        updateProgress();

        // 点击评价按钮
        console.log(`[批量评教] 正在评教: ${teacher.name}`);
        teacher.button.click();

        // 等待页面跳转，然后让评教页面的脚本接管
        // 评教页面完成后会发送消息回来
    }

    /**
     * 更新进度显示
     */
    function updateProgress() {
        const progressText = document.getElementById('batch-progress-text');
        const progressFill = document.getElementById('batch-progress-fill');
        
        if (progressText) {
            progressText.textContent = `${currentIndex}/${pendingTeachers.length}`;
        }
        
        if (progressFill && pendingTeachers.length > 0) {
            const percent = (currentIndex / pendingTeachers.length) * 100;
            progressFill.style.width = `${percent}%`;
        }
    }

    /**
     * 完成一个教师的评教，继续下一个
     */
    function completeCurrentTeacher() {
        if (!isBatchRunning) return;

        currentIndex++;
        chrome.runtime.sendMessage({ action: 'incrementCompleted' });

        const hasDelay = document.getElementById('auto-delay-check')?.checked;
        const delay = hasDelay ? 3000 : 500;

        setTimeout(() => {
            // 刷新页面获取最新状态
            location.reload();
            
            // 页面刷新后，等待重新加载完成再继续
            setTimeout(() => {
                if (isBatchRunning) {
                    pendingTeachers = parseTeacherList();
                    processNextTeacher();
                }
            }, 2000);
        }, delay);
    }

    /**
     * 完成批量评教
     */
    function finishBatch() {
        isBatchRunning = false;
        
        document.getElementById('btn-start-batch').style.display = 'flex';
        document.getElementById('btn-stop-batch').style.display = 'none';
        document.getElementById('batch-status-text').textContent = '已完成';
        document.getElementById('batch-status-text').className = 'status-value completed';
        document.getElementById('batch-current-teacher').style.display = 'none';
        
        updateProgress();
        
        chrome.runtime.sendMessage({ action: 'stopBatch' });
        showBatchNotification('批量评教已完成！', 'success');
    }

    /**
     * 显示批量评教通知
     */
    function showBatchNotification(message, type) {
        const oldNotification = document.getElementById('batch-notification');
        if (oldNotification) oldNotification.remove();

        const notification = document.createElement('div');
        notification.id = 'batch-notification';
        notification.className = `batch-notification ${type}`;
        notification.innerHTML = `
            <span class="notification-icon">${type === 'success' ? '✓' : type === 'warning' ? '⚠' : 'ℹ'}</span>
            <span class="notification-text">${message}</span>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * 使元素可拖动
     */
    function makeDraggable(element) {
        const header = element.querySelector('.batch-panel-header');
        let isDragging = false;
        let currentX, currentY, initialX, initialY;
        let xOffset = 0, yOffset = 0;

        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);

        function dragStart(e) {
            if (e.target.classList.contains('batch-toggle-btn')) return;

            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            if (e.target === header || header.contains(e.target)) {
                isDragging = true;
            }
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                xOffset = currentX;
                yOffset = currentY;

                element.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        }

        function dragEnd() {
            initialX = element.getBoundingClientRect().left;
            initialY = element.getBoundingClientRect().top;
            xOffset = 0;
            yOffset = 0;
            element.style.transform = 'translate(0,0)';
            element.style.left = initialX + 'px';
            element.style.top = initialY + 'px';
            isDragging = false;
        }
    }

    /**
     * 监听来自评教页面和popup的消息
     */
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'evaluationComplete') {
            // 评教页面完成评教，继续下一个
            completeCurrentTeacher();
            sendResponse({ success: true });
        } else if (request.action === 'startBatchFromPopup') {
            // 从popup启动批量评教
            if (isBatchRunning) {
                sendResponse({ success: false, message: '批量评教已在进行中' });
                return true;
            }
            
            pendingTeachers = parseTeacherList();
            if (pendingTeachers.length === 0) {
                sendResponse({ success: false, message: '没有需要评教的教师' });
                return true;
            }
            
            // 更新UI
            document.getElementById('btn-start-batch').style.display = 'none';
            document.getElementById('btn-stop-batch').style.display = 'flex';
            document.getElementById('batch-status-text').textContent = '进行中...';
            document.getElementById('batch-status-text').className = 'status-value running';
            document.getElementById('batch-current-teacher').style.display = 'block';
            
            // 保存状态到background
            chrome.runtime.sendMessage({
                action: 'startBatch',
                totalTeachers: pendingTeachers.length
            });
            
            isBatchRunning = true;
            currentIndex = 0;
            
            showBatchNotification(`开始批量评教，共 ${pendingTeachers.length} 位教师`, 'success');
            
            // 开始评教流程
            setTimeout(() => processNextTeacher(), 500);
            
            sendResponse({ success: true });
        } else if (request.action === 'getBatchStatus') {
            sendResponse({ 
                success: true, 
                isRunning: isBatchRunning,
                total: pendingTeachers.length,
                current: currentIndex
            });
        }
        return true;
    });

    /**
     * 初始化
     */
    function init() {
        console.log('[自动评教] 入口页面脚本已加载');
        createBatchPanel();
        
        // 检查是否是从评教页面返回的
        chrome.runtime.sendMessage({ action: 'getBatchState' }, (response) => {
            if (response && response.state && response.state.isRunning) {
                // 恢复批量评教状态
                setTimeout(() => {
                    pendingTeachers = parseTeacherList();
                    if (pendingTeachers.length > 0) {
                        isBatchRunning = true;
                        currentIndex = response.state.completedTeachers;
                        updateProgress();
                        processNextTeacher();
                    }
                }, 1500);
            }
        });
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
