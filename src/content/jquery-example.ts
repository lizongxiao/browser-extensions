import { $j } from "@/utils/jquery";

// 示例：当DOM加载完成后执行
$j(document).ready(function () {
  // 添加一个简单的样式
  $j("body").css("position", "relative");

  // 创建并添加一个简单的浮动按钮到页面
  const $button = $j("<button>")
    .text("Hello jQuery!")
    .css({
      position: "fixed",
      bottom: "20px",
      left: "20px",
      padding: "10px 15px",
      backgroundColor: "#4285f4",
      color: "white",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      zIndex: 9999,
    })
    .on("click", function () {
      // 改变颜色
      $j("body").css("backgroundColor", "red");
    });

  $j("body").append($button);

  console.log("jQuery内容脚本已加载!");
});
