/*
 * vreact.js
 * Copyright (C) 2025 veypi <i@veypi.com>
 *
 * Distributed under terms of the MIT license.
 */
// 简单的依赖收集器
let activeEffect = null;
const targetMap = new WeakMap(); // 存储每个目标对象的依赖

function track(target, key) {
  if (activeEffect) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      depsMap = new Map();
      targetMap.set(target, depsMap);
    }
    let dep = depsMap.get(key);
    if (!dep) {
      dep = new Set();
      depsMap.set(key, dep);
    }
    dep.add(activeEffect);
  }
}

function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  const dep = depsMap.get(key);
  if (dep) {
    dep.forEach(effect => effect());
  }
}

// 创建响应式对象
function reactive(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      track(target, key); // 收集依赖
      return Reflect.get(target, key, receiver);
    },
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver);
      trigger(target, key); // 派发更新
      return result;
    }
  });
}

// 包装函数
function watchEffect(fn) {
  const effect = () => {
    activeEffect = effect; // 设置当前执行的effect
    fn();
    activeEffect = null; // 清除
  };
  effect(); // 立即执行一次进行依赖收集
}

// 使用示例
const state = reactive({ a: 1, b: 2 });

watchEffect(() => {
  console.log('函数重新执行了:', state.a && state.b); // a && b
});

state.a = 0; // 即使a为0，b没有被访问到，但因为b是响应式对象的一部分，且在proxy get时被track到，所以只要b改变，仍然会触发
state.b = 3; // 触发

export default {}
