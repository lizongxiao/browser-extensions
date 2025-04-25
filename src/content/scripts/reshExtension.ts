/**
 * 扩展重新加载模块
 *
 * 该模块负责在需要时重新加载扩展，例如在扩展代码更新或初始化失败后。
 * 它会清理现有的UI元素并刷新页面，以确保扩展在一个干净的环境中重启。
 */

import { removeExistingUIElements } from "./activateCanvasMode";

/**
 * 重新加载扩展
 *
 * 清理当前页面上的所有扩展UI元素，然后刷新整个页面。
 * 这确保了扩展可以在一个干净的状态下重新初始化。
 */
export function reshExtension() {
  // 移除可能存在的旧UI元素
  removeExistingUIElements();

  // 刷新页面
  window.location.reload();
}
