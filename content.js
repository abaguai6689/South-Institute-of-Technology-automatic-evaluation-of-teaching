/**
 * 超星自动评教助手 - 评教页面内容脚本
 * 自动填写评教表单并支持完整提交流程
 * 支持可修改的题目评分设置
 */

(function() {
    'use strict';

    // 评分配置 - 根据已完成评教的模版设置
    const DEFAULT_SCORES = {
        // 指标一：课程设计（35分）
        '课程资源': { score: 10, maxScore: 10 },
        '课程思政': { score: 9, maxScore: 10 },
        '课程内容': { score: 9, maxScore: 10 },
        '课程目标': { score: 5, maxScore: 5 },
        
        // 指标二：教师教学（25分）
        '师德师风': { score: 5, maxScore: 5 },
        '教学水平': { score: 5, maxScore: 10 },
        '指导答疑': { score: 5, maxScore: 5 },
        '教学方法': { score: 5, maxScore: 5 },
        
        // 指标三：学习效果（40分）
        '课堂参与': { score: 10, maxScore: 10 },
        '知识掌握': { score: 10, maxScore: 10 },
        '能力提升': { score: 10, maxScore: 10 },
        '素养提升': { score: 10, maxScore: 10 }
    };

    // 简答题答案
    const TEXT_ANSWER = '无';

    // 批量模式状态
    let isBatchMode = false;
    
    // 自定义评分存储
    let customScores = {};

    /**
     * 从 Storage 加载自定义评分
     */
    function loadCustomScores() {
        return new Promise(resolve => {
            chrome.storage.local.get(['customScores'], (result) => {
                customScores = result.customScores || {};
                resolve(customScores);
            });
        });
    }

    /**
     * 保存自定义评分到 Storage
     */
    function saveCustomScores() {
        return new Promise(resolve => {
            chrome.storage.local.set({ customScores }, resolve);
        });
    }

    /**
     * 从页面解析题目信息
     */
    function parseQuestions() {
        const questions = [];
        const testBoxes = document.querySelectorAll('.testBox.groupTarget');
        
        testBoxes.forEach((box, index) => {
            const titleEl = box.querySelector('.target-title');
            const inputEl = box.querySelector('input.dafen[type="text"]');
            const textareaEl = box.querySelector('textarea.blueTextarea');
            
            if (titleEl) {
                const title = titleEl.getAttribute('value') || titleEl.textContent.trim();
                
                // 解析分值范围
                const tmTi = box.querySelector('.tmTi');
                let maxScore = null;
                let minScore = null;
                
                if (tmTi) {
                    const text = tmTi.textContent;
                    const match = text.match(/打分区间[：:]\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*分/);
                    if (match) {
                        minScore = parseFloat(match[1]);
                        maxScore = parseFloat(match[2]);
                    }
                }
                
                // 从input元素获取分值限制
                if (inputEl) {
                    const attrMax = inputEl.getAttribute('maxscore');
                    const attrMin = inputEl.getAttribute('minscore');
                    if (attrMax) maxScore = parseFloat(attrMax);
                    if (attrMin) minScore = parseFloat(attrMin);
                }
                
                questions.push({
                    index: index + 1,
                    title: title,
                    inputElement: inputEl,
                    textareaElement: textareaEl,
                    maxScore: maxScore,
                    minScore: minScore,
                    isTextQuestion: !!textareaEl
                });
            }
        });
        
        return questions;
    }

    /**
     * 根据题目名称获取应填分数
     */
    function getScoreForQuestion(title, maxScore) {
        // 优先使用自定义评分
        const customScore = customScores[title];
        if (customScore !== undefined) {
            return customScore;
        }
        
        for (const [key, value] of Object.entries(DEFAULT_SCORES)) {
            if (title.includes(key)) {
                return Math.min(value.score, maxScore);
            }
        }
        
        // 如果没有匹配到，根据maxScore返回默认值
        if (maxScore === 10) return 9;
        if (maxScore === 5) return 5;
        return maxScore;
    }

    /**
     * 填写单个打分题
     */
    function fillScoreQuestion(question) {
        if (!question.inputElement) return false;
        
        const score = getScoreForQuestion(question.title, question.maxScore);
        
        question.inputElement.value = score;
        question.inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        question.inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        question.inputElement.dispatchEvent(new Event('blur', { bubbles: true }));
        
        if (typeof jQuery !== 'undefined') {
            jQuery(question.inputElement).trigger('input').trigger('change');
        }
        
        console.log(`[自动评教] 第${question.index}题 "${question.title}" 已填写: ${score}分`);
        return true;
    }

    /**
     * 填写简答题
     */
    function fillTextQuestion(question) {
        if (!question.textareaElement) return false;
        
        question.textareaElement.value = TEXT_ANSWER;
        question.textareaElement.dispatchEvent(new Event('input', { bubbles: true }));
        question.textareaElement.dispatchEvent(new Event('change', { bubbles: true }));
        
        console.log(`[自动评教] 第${question.index}题 "${question.title}" 已填写: ${TEXT_ANSWER}`);
        return true;
    }

    /**
     * 自动填写所有题目
     */
    function autoFillAll() {
        const questions = parseQuestions();
        let filledCount = 0;
        let textFilledCount = 0;
        
        console.log('[自动评教] 开始自动填写，共发现 ' + questions.length + ' 道题目');
        
        questions.forEach(question => {
            if (question.isTextQuestion) {
                if (fillTextQuestion(question)) textFilledCount++;
            } else {
                if (fillScoreQuestion(question)) filledCount++;
            }
        });
        
        updateTotalScore();
        
        const message = `填写完成！打分题: ${filledCount} 道, 简答题: ${textFilledCount} 道`;
        console.log('[自动评教] ' + message);
        
        return { filledCount, textFilledCount, total: questions.length };
    }

    /**
     * 更新页面上的总分显示
     */
    function updateTotalScore() {
        const questions = parseQuestions();
        let total = 0;
        
        questions.forEach(q => {
            if (q.inputElement && q.inputElement.value) {
                total += parseFloat(q.inputElement.value) || 0;
            }
        });
        
        const scoreElement = document.getElementById('fudongScore');
        if (scoreElement) {
            scoreElement.textContent = total.toFixed(1);
        }
        
        return total;
    }

    /**
     * 点击提交按钮
     */
    function clickSubmit() {
        const submitBtn = document.querySelector('a.save');
        if (submitBtn) {
            console.log('[自动评教] 点击提交按钮');
            submitBtn.click();
            return true;
        }
        console.warn('[自动评教] 未找到提交按钮');
        return false;
    }

    /**
     * 点击确认对话框的确定按钮
     */
    function clickConfirm() {
        // layui 确认对话框
        const confirmBtn = document.querySelector('.layui-layer-btn .layui-layer-btn0');
        if (confirmBtn) {
            console.log('[自动评教] 点击确认按钮');
            confirmBtn.click();
            return true;
        }
        return false;
    }

    /**
     * 点击返回按钮
     */
    function clickBack() {
        const backBtn = document.querySelector('a.back');
        if (backBtn) {
            console.log('[自动评教] 点击返回按钮');
            backBtn.click();
            return true;
        }
        console.warn('[自动评教] 未找到返回按钮');
        return false;
    }

    /**
     * 完整的自动评教流程
     */
    async function runFullAutoEvaluation() {
        console.log('[自动评教] ===== 开始完整自动评教流程 =====');
        
        // 1. 填写表单
        const fillResult = autoFillAll();
        showNotification(`已填写 ${fillResult.total} 道题目`, 'info');
        
        // 等待填写完成
        await delay(1000);
        
        // 2. 点击提交
        if (!clickSubmit()) {
            showNotification('未找到提交按钮', 'error');
            return false;
        }
        
        // 3. 等待确认对话框出现并点击确认
        await delay(800);
        
        let confirmAttempts = 0;
        const maxConfirmAttempts = 10;
        
        while (confirmAttempts < maxConfirmAttempts) {
            if (clickConfirm()) {
                showNotification('已确认提交', 'success');
                break;
            }
            await delay(500);
            confirmAttempts++;
        }
        
        if (confirmAttempts >= maxConfirmAttempts) {
            showNotification('未检测到确认对话框', 'warning');
        }
        
        // 4. 等待提交完成
        await delay(1500);
        
        // 5. 点击返回
        if (clickBack()) {
            showNotification('正在返回列表...', 'info');
        }
        
        console.log('[自动评教] ===== 评教流程完成 =====');
        return true;
    }

    /**
     * 延时函数
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 显示通知
     */
    function showNotification(message, type = 'success') {
        const oldNotification = document.getElementById('auto-evaluate-notification');
        if (oldNotification) oldNotification.remove();

        const colors = {
            success: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            info: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
            warning: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
            error: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)'
        };

        const notification = document.createElement('div');
        notification.id = 'auto-evaluate-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.success};
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.25);
            z-index: 999999;
            font-family: 'Microsoft YaHei', sans-serif;
            font-size: 14px;
            max-width: 300px;
            animation: slideIn 0.3s ease-out;
        `;
        notification.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:18px;">${type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warning' ? '⚠' : 'ℹ'}</span>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * 显示评分编辑对话框
     */
    function showScoreEditDialog(question) {
        const currentScore = customScores[question.title] !== undefined 
            ? customScores[question.title] 
            : getScoreForQuestion(question.title, question.maxScore);
        
        const dialog = document.createElement('div');
        dialog.id = 'score-edit-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 1000000;
            padding: 24px;
            width: 90%;
            max-width: 400px;
            font-family: 'Microsoft YaHei', sans-serif;
        `;
        
        const overlay = document.createElement('div');
        overlay.id = 'score-edit-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 999999;
        `;
        
        dialog.innerHTML = `
            <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px;">编辑评分</h3>
            <div style="margin-bottom: 12px; color: #666; font-size: 14px;">
                <strong>题目：</strong>${question.title}
            </div>
            <div style="margin-bottom: 16px; color: #666; font-size: 14px;">
                <strong>分值范围：</strong>${question.minScore || 0} - ${question.maxScore} 分
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; color: #555; font-weight: 500;">手动输入：</label>
                <input type="number" id="score-input" value="${currentScore}" 
                    min="${question.minScore || 0}" max="${question.maxScore}" step="0.1"
                    style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; color: #555; font-weight: 500;">快速选择：</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                    <button class="quick-btn" data-score="${question.minScore || 0}" style="padding: 8px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-weight: 500; color: #667eea; transition: all 0.2s;">最低分 (${question.minScore || 0})</button>
                    <button class="quick-btn" data-score="${(question.maxScore + (question.minScore || 0)) / 2}" style="padding: 8px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-weight: 500; color: #667eea; transition: all 0.2s;">中位分 (${((question.maxScore + (question.minScore || 0)) / 2).toFixed(1)})</button>
                    <button class="quick-btn" data-score="${question.maxScore}" style="padding: 8px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-weight: 500; color: #667eea; transition: all 0.2s;">最高分 (${question.maxScore})</button>
                </div>
            </div>
            <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button id="btn-cancel-edit" style="flex: 1; padding: 12px; background: #f0f0f0; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; color: #555; transition: all 0.3s;">取消</button>
                <button id="btn-confirm-edit" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 6px; cursor: pointer; font-weight: 600; color: white; transition: all 0.3s;">确定</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        document.body.appendChild(dialog);
        
        const input = dialog.querySelector('#score-input');
        const quickBtns = dialog.querySelectorAll('.quick-btn');
        const confirmBtn = dialog.querySelector('#btn-confirm-edit');
        const cancelBtn = dialog.querySelector('#btn-cancel-edit');
        
        quickBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                input.value = btn.dataset.score;
                input.focus();
            });
            
            btn.addEventListener('mouseover', () => {
                btn.style.background = '#667eea';
                btn.style.color = 'white';
            });
            
            btn.addEventListener('mouseout', () => {
                btn.style.background = 'white';
                btn.style.color = '#667eea';
            });
        });
        
        confirmBtn.addEventListener('click', () => {
            const score = parseFloat(input.value);
            if (score >= (question.minScore || 0) && score <= question.maxScore) {
                customScores[question.title] = score;
                saveCustomScores();
                updateQuestionsPanel();
                removeDialog();
                showNotification(`已更新 "${question.title}" 的评分为 ${score}`, 'success');
            } else {
                showNotification(`分值应在 ${question.minScore || 0} - ${question.maxScore} 之间`, 'error');
            }
        });
        
        cancelBtn.addEventListener('click', removeDialog);
        overlay.addEventListener('click', removeDialog);
        
        function removeDialog() {
            if (dialog.parentNode) document.body.removeChild(dialog);
            if (overlay.parentNode) document.body.removeChild(overlay);
        }
        
        input.focus();
    }

    /**
     * 更新题目列表面板
     */
    function updateQuestionsPanel() {
        const questions = parseQuestions().filter(q => !q.isTextQuestion);
        const listContainer = document.querySelector('#auto-evaluate-panel .questions-list');
        
        if (!listContainer) return;
        
        listContainer.innerHTML = '';
        
        questions.forEach(question => {
            const score = customScores[question.title] !== undefined 
                ? customScores[question.title]
                : getScoreForQuestion(question.title, question.maxScore);
            
            const item = document.createElement('div');
            item.className = 'question-item';
            item.innerHTML = `
                <div class="q-title">${question.title}</div>
                <div class="q-score">
                    <div class="score-value">${score}/${question.maxScore}</div>
                    <button class="edit-btn" title="编辑">✎</button>
                </div>
            `;
            
            const editBtn = item.querySelector('.edit-btn');
            editBtn.addEventListener('click', () => showScoreEditDialog(question));
            
            listContainer.appendChild(item);
        });
    }

    /**
     * 创建浮动控制面板
     */
    function createControlPanel() {
        if (document.getElementById('auto-evaluate-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'auto-evaluate-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <span>📝 自动评教助手</span>
                <button class="toggle-btn" title="最小化">−</button>
            </div>
            <div class="panel-body">
                <div class="info-text">
                    <p>检测到评教页面</p>
                    <p class="sub-text">点击下方按钮自动填写</p>
                </div>
                <button class="action-btn primary" id="btn-auto-fill">
                    <span class="btn-icon">✓</span>
                    一键自动填写
                </button>
                <button class="action-btn secondary" id="btn-auto-full">
                    <span class="btn-icon">🚀</span>
                    自动填写并提交
                </button>
                
                <div class="score-editor-section">
                    <div class="section-title">📋 题目评分编辑</div>
                    <div class="questions-list"></div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // 绑定事件
        document.getElementById('btn-auto-fill').addEventListener('click', () => {
            const result = autoFillAll();
            showNotification(`已填写 ${result.filledCount + result.textFilledCount} 道题目`);
        });

        document.getElementById('btn-auto-full').addEventListener('click', async () => {
            const btn = document.getElementById('btn-auto-full');
            btn.disabled = true;
            btn.innerHTML = '<span class="btn-icon loading"></span> 处理中...';
            
            await runFullAutoEvaluation();
            
            btn.disabled = false;
            btn.innerHTML = '<span class="btn-icon">🚀</span> 自动填写并提交';
        });

        // 最小化按钮
        const toggleBtn = panel.querySelector('.toggle-btn');
        const body = panel.querySelector('.panel-body');
        let isMinimized = false;

        toggleBtn.addEventListener('click', () => {
            isMinimized = !isMinimized;
            body.style.display = isMinimized ? 'none' : 'block';
            toggleBtn.textContent = isMinimized ? '+' : '−';
        });

        // 初始化题目列表
        updateQuestionsPanel();

        makeDraggable(panel);
    }

    /**
     * 使元素可拖动
     */
    function makeDraggable(element) {
        const header = element.querySelector('.panel-header');
        let isDragging = false;
        let currentX, currentY, initialX, initialY;
        let xOffset = 0, yOffset = 0;

        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);

        function dragStart(e) {
            if (e.target.classList.contains('toggle-btn')) return;
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
     * 添加动画样式
     */
    function addAnimations() {
        if (document.getElementById('auto-evaluate-animations')) return;

        const style = document.createElement('style');
        style.id = 'auto-evaluate-animations';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            .loading {
                display: inline-block;
                width: 14px;
                height: 14px;
                border: 2px solid #fff;
                border-top-color: transparent;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 初始化
     */
    async function init() {
        console.log('[自动评教] 评教页面脚本已加载');
        
        // 加载自定义评分
        await loadCustomScores();
        
        addAnimations();
        createControlPanel();

        // 监听来自popup和background的消息
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'fill') {
                const result = autoFillAll();
                sendResponse({ success: true, ...result });
            } else if (request.action === 'getStatus') {
                const questions = parseQuestions();
                sendResponse({ 
                    success: true, 
                    totalQuestions: questions.length,
                    hasForm: questions.length > 0
                });
            } else if (request.action === 'autoSubmit') {
                runFullAutoEvaluation().then(success => {
                    sendResponse({ success });
                });
                return true;
            }
            return true;
        });

        // 检查是否处于批量模式
        chrome.runtime.sendMessage({ action: 'getBatchState' }, (response) => {
            if (response && response.state && response.state.isRunning) {
                isBatchMode = true;
                console.log('[自动评教] 检测到批量模式，自动开始评教');
                setTimeout(async () => {
                    await runFullAutoEvaluation();
                    // 通知入口页面继续下一个
                    chrome.runtime.sendMessage({ action: 'evaluationComplete' });
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