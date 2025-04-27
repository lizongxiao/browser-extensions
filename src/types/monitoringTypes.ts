// 监控项类型定义

// 基础监控项
export interface BaseMonitoringItem {
  id: string;         // 唯一标识
  url: string;        // 页面URL
  title: string;      // 页面标题
  timestamp: string;  // 创建时间
  lastCheck?: string; // 最后检查时间
  lastContent: string;// 最后的内容(用于比较)
  hasUpdates?: boolean; // 是否有未读更新
  pathPoints: { x: number; y: number }[]; // 选择路径点
  left: number;       // 左边位置
  top: number;        // 顶部位置
  width: number;      // 宽度
  height: number;     // 高度
}

// 元素监控项
export interface ElementMonitoringItem extends BaseMonitoringItem {
  selectionType: 'elements';
  elements: ElementInfo[];
}

// 区域监控项
export interface RegionMonitoringItem extends BaseMonitoringItem {
  selectionType: 'region';
  html: string;       // 区域HTML
  innerText: string;  // 区域文本内容
}

// 元素信息
export interface ElementInfo {
  tag: string;        // 标签名
  id?: string;        // 元素ID
  className?: string; // 类名
  text?: string;      // 文本内容
  xpath: string;      // XPath路径
  html: string;       // 元素HTML
  innerText: string;  // 元素文本内容
}

// 联合类型
export type MonitoringItem = ElementMonitoringItem | RegionMonitoringItem;

// 变更检查结果
export interface ContentCheckResult {
  hasChanged: boolean;
  newContent?: string;
  newInnerText?: string;
  timeChecked: string;
  type: 'elements' | 'region';
}

// 应用设置
export interface AppSettings {
  checkInterval: number; // 检查间隔(分钟)
} 