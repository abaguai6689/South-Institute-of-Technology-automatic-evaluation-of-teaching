/**
 * 超星自动评教助手 - 后台脚本
 * 用于管理批量评教状态
 */

// 批量评教状态
let batchState = {
    isRunning: false,
    totalTeachers: 0,
    completedTeachers: 0,
    currentTeacherName: '',
    startTime: null
};

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getBatchState') {
        sendResponse({ success: true, state: batchState });
    } else if (request.action === 'setBatchState') {
        batchState = { ...batchState, ...request.state };
        sendResponse({ success: true });
    } else if (request.action === 'startBatch') {
        batchState = {
            isRunning: true,
            totalTeachers: request.totalTeachers || 0,
            completedTeachers: 0,
            currentTeacherName: '',
            startTime: Date.now()
        };
        sendResponse({ success: true });
    } else if (request.action === 'stopBatch') {
        batchState.isRunning = false;
        sendResponse({ success: true });
    } else if (request.action === 'incrementCompleted') {
        batchState.completedTeachers++;
        sendResponse({ success: true, state: batchState });
    } else if (request.action === 'setCurrentTeacher') {
        batchState.currentTeacherName = request.teacherName;
        sendResponse({ success: true });
    }
    return true;
});

console.log('[自动评教] 后台脚本已加载');
