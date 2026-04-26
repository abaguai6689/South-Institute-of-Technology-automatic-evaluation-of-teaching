/**
 * 超星自动评教助手 - Popup 脚本
 */

document.addEventListener('DOMContentLoaded', function() {
    const btnFill = document.getElementById('btn-fill');
    const btnAutoFull = document.getElementById('btn-auto-full');
    const btnStartBatch = document.getElementById('btn-start-batch');
    const btnStopBatch = document.getElementById('btn-stop-batch');
    const btnRefresh = document.getElementById('btn-refresh');
    const pageType = document.getElementById('page-type');
    const pageStatus = document.getElementById('page-status');
    const questionCount = document.getElementById('question-count');
    const messageEl = document.getElementById('message');
    const evaluateButtons = document.getElementById('evaluate-buttons');
    const listButtons = document.getElementById('list-buttons');
    const batchStatusCard = document.getElementById('batch-status-card');
    const batchProgressFill = document.getElementById('batch-progress-fill');
    const batchInfo = document.getElementById('batch-info');

    let currentTab = null;
    let pageTypeValue = 'other';

    // 检查当前页面状态
    async function checkStatus() {
        pageStatus.textContent = '检测中...';
        pageStatus.className = 'status-value inactive';
        btnFill.disabled = true;
        btnAutoFull.disabled = true;

        try {
            [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!currentTab || !currentTab.url) {
                pageStatus.textContent = '无法获取页面';
                pageType.textContent = '未知';
                pageType.className = 'page-type-badge other';
                return;
            }

            const url = currentTab.url;

            // 判断页面类型
            if (url.includes('newes.chaoxing.com/pj/newesReception/questionnaireInfo')) {
                // 评教表单页面
                pageTypeValue = 'evaluate';
                pageType.textContent = '评教页面';
                pageType.className = 'page-type-badge evaluate';
                evaluateButtons.style.display = 'block';
                listButtons.style.display = 'none';
                
                // 向 content script 发送消息
                chrome.tabs.sendMessage(currentTab.id, { action: 'getStatus' }, (response) => {
                    if (chrome.runtime.lastError) {
                        pageStatus.textContent = '插件未加载';
                        questionCount.textContent = '-';
                        return;
                    }

                    if (response && response.success) {
                        if (response.hasForm) {
                            pageStatus.textContent = '✓ 就绪';
                            pageStatus.className = 'status-value';
                            questionCount.textContent = response.totalQuestions + ' 道';
                            btnFill.disabled = false;
                            btnAutoFull.disabled = false;
                        } else {
                            pageStatus.textContent = '未检测到表单';
                            questionCount.textContent = '0';
                        }
                    }
                });
            } else if (url.includes('newes.chaoxing.com/pj/frontv2/whatIEvaluatedDetails')) {
                // 教师列表页面
                pageTypeValue = 'list';
                pageType.textContent = '教师列表';
                pageType.className = 'page-type-badge list';
                pageStatus.textContent = '✓ 支持批量评教';
                pageStatus.className = 'status-value';
                questionCount.textContent = '-';
                evaluateButtons.style.display = 'none';
                listButtons.style.display = 'block';
                
                // 检查批量状态
                checkBatchStatus();
            } else {
                // 其他页面
                pageTypeValue = 'other';
                pageType.textContent = '其他页面';
                pageType.className = 'page-type-badge other';
                pageStatus.textContent = '非评教页面';
                questionCount.textContent = '-';
                evaluateButtons.style.display = 'none';
                listButtons.style.display = 'none';
            }
        } catch (error) {
            pageStatus.textContent = '检测失败';
            console.error('检查状态失败:', error);
        }
    }

    // 检查批量评教状态
    async function checkBatchStatus() {
        chrome.runtime.sendMessage({ action: 'getBatchState' }, (response) => {
            if (response && response.state) {
                const state = response.state;
                
                if (state.isRunning) {
                    batchStatusCard.classList.add('active');
                    btnStartBatch.style.display = 'none';
                    btnStopBatch.style.display = 'flex';
                    
                    const percent = state.totalTeachers > 0 
                        ? (state.completedTeachers / state.totalTeachers) * 100 
                        : 0;
                    batchProgressFill.style.width = percent + '%';
                    batchInfo.textContent = `已完成: ${state.completedTeachers}/${state.totalTeachers}`;
                    if (state.currentTeacherName) {
                        batchInfo.textContent += ` | 当前: ${state.currentTeacherName}`;
                    }
                } else {
                    batchStatusCard.classList.remove('active');
                    btnStartBatch.style.display = 'flex';
                    btnStopBatch.style.display = 'none';
                }
            }
        });
    }

    // 显示消息
    function showMessage(text, type) {
        messageEl.textContent = text;
        messageEl.className = 'message ' + type;
        setTimeout(() => {
            messageEl.className = 'message';
        }, 3000);
    }

    // 点击填写按钮
    btnFill.addEventListener('click', async () => {
        btnFill.disabled = true;
        const originalText = btnFill.innerHTML;
        btnFill.innerHTML = '<span class="loading"></span> 填写中...';

        try {
            chrome.tabs.sendMessage(currentTab.id, { action: 'fill' }, (response) => {
                btnFill.innerHTML = originalText;
                btnFill.disabled = false;

                if (chrome.runtime.lastError) {
                    showMessage('填写失败: ' + chrome.runtime.lastError.message, 'error');
                    return;
                }

                if (response && response.success) {
                    showMessage(
                        `填写成功！打分题: ${response.filledCount}道, 简答题: ${response.textFilledCount}道`, 
                        'success'
                    );
                } else {
                    showMessage('填写失败', 'error');
                }
            });
        } catch (error) {
            btnFill.innerHTML = originalText;
            btnFill.disabled = false;
            showMessage('填写失败: ' + error.message, 'error');
        }
    });

    // 点击自动填写并提交按钮
    btnAutoFull.addEventListener('click', async () => {
        btnAutoFull.disabled = true;
        const originalText = btnAutoFull.innerHTML;
        btnAutoFull.innerHTML = '<span class="loading"></span> 处理中...';

        try {
            chrome.tabs.sendMessage(currentTab.id, { action: 'autoSubmit' }, (response) => {
                btnAutoFull.innerHTML = originalText;
                btnAutoFull.disabled = false;

                if (chrome.runtime.lastError) {
                    showMessage('操作失败: ' + chrome.runtime.lastError.message, 'error');
                    return;
                }

                if (response && response.success) {
                    showMessage('评教完成，正在返回列表...', 'success');
                } else {
                    showMessage('操作失败', 'error');
                }
            });
        } catch (error) {
            btnAutoFull.innerHTML = originalText;
            btnAutoFull.disabled = false;
            showMessage('操作失败: ' + error.message, 'error');
        }
    });

    // 点击开始批量评教按钮
    btnStartBatch.addEventListener('click', async () => {
        // 向列表页面发送开始批量评教的消息
        chrome.tabs.sendMessage(currentTab.id, { action: 'startBatchFromPopup' }, (response) => {
            if (chrome.runtime.lastError) {
                showMessage('启动失败: ' + chrome.runtime.lastError.message, 'error');
                return;
            }
            
            if (response && response.success) {
                showMessage('批量评教已启动', 'success');
                checkBatchStatus();
            } else {
                showMessage(response?.message || '启动失败', 'error');
            }
        });
    });

    // 点击停止批量评教按钮
    btnStopBatch.addEventListener('click', async () => {
        chrome.runtime.sendMessage({ action: 'stopBatch' }, () => {
            showMessage('批量评教已停止', 'warning');
            checkBatchStatus();
        });
    });

    // 点击刷新按钮
    btnRefresh.addEventListener('click', () => {
        checkStatus();
    });

    // 定时刷新批量状态
    setInterval(() => {
        if (pageTypeValue === 'list') {
            checkBatchStatus();
        }
    }, 2000);

    // 初始检查
    checkStatus();
});
