/**
 * jQuery无冲突模式工具
 */

import $ from "jquery";

// 将jQuery设置为无冲突模式，并导出
const jQuery = $.noConflict(true);

// 导出无冲突模式的jQuery
export default jQuery;

// 导出$j作为简短别名
export const $j = jQuery;
