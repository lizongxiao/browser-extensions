<template>
  <div class="container">Popup</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

interface Props {
  msg?: string;
}

interface Emits {
  (e: "change", value: string): void;
}

defineOptions({
  name: "Popup",
  description: "弹出页",
});

withDefaults(defineProps<Props>(), {
  msg: "default value",
});

const emit = defineEmits<Emits>();

const count = ref(0);

const increment = () => {
  count.value++;
  emit("change", `Count is: ${count.value}`);
};

onMounted(() => {
  console.log("加载弹出页");
});

defineExpose({
  increment,
});
</script>

<style scoped>
.container {
  padding: 20px;
}
</style>
