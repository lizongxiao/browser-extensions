// 监控项类型定义

// 内容历史记录条目
export interface ContentHistoryEntry {
  content: string;    // 内容
  timestamp: number;  // 记录时间
}

// 差异片段类型
export enum DiffFragmentType {
  NORMAL = 'normal',
  PRICE = 'price',
  LINK = 'link',
  HASH = 'hash',
  DATE = 'date',
  NUMBER = 'number'
}

// 差异文本片段
export interface DiffFragment {
  type: DiffFragmentType;  // 差异类型
  oldText: string;         // 原文本
  newText: string;         // 新文本
  context?: string;        // 上下文 (可选)
}

// 差异信息
export interface DiffInfo {
  added: string[];           // 添加的行
  removed: string[];         // 删除的行
  fragments: DiffFragment[]; // 精细差异片段
  timestamp: number;         // 差异产生时间
}

// 数值监控设置
export interface ValueRangeSettings {
  enabled: boolean;          // 是否启用数值监控
  minValue?: number;         // 最小值 (可选，不设置则只检查最大值)
  maxValue?: number;         // 最大值 (可选，不设置则只检查最小值)
  currentValue?: number;     // 当前值
  maxNotifications: number;  // 最大通知次数
  notificationCount: number; // 当前通知次数
}

// 基础监控项
export interface BaseMonitoringItem {
  id: string;         // 唯一标识
  url: string;        // 页面URL
  title: string;      // 页面标题
  timestamp: number;  // 创建时间
  name: string;        // 名称
  hasUpdates: boolean; // 是否有未读更新
  lastCheck?: number; // 最后检查时间
  contentHistory?: ContentHistoryEntry[]; // 内容历史记录
  lastDiff?: DiffInfo; // 最近一次变化的差异信息
  maxHistoryLength?: number;  // 最大历史记录长度，默认为5
  valueRange?: ValueRangeSettings; // 数值范围监控设置
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
  extractedValues?: {   // 提取的数值
    value: number;      // 提取到的数值
    context: string;    // 数值的上下文信息
  }[];
}

// 应用设置
export interface AppSettings {
  checkInterval: number; // 检查间隔(分钟)
} 