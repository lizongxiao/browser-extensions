/**
 * jQuery类型声明增强
 *
 * 这个文件扩展jQuery的类型声明，以确保无冲突模式能够正确工作
 */

// 确保jQuery模块可以被正确导入
declare module "jquery" {
  export = jQuery;
  export const $j: typeof jQuery;
}
