// 背景脚本入口
import "./scripts/savedSelections";
import "./scripts/addListener";
import "./scripts/shortcutKey";
import "./scripts/updateBadge";
import initElementChecker from "./scripts/elementChecker";

console.log("开始加载背景脚本");

// 初始化元素检查器
initElementChecker();
