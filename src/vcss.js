/*
 * vcss.js
 * Copyright (C) 2025 veypi <i@veypi.com>
 *
 * Distributed under terms of the GPL license.
 * simple css parser
 */



class CSSParser {
  constructor() {
    this.scopeAttribute = '';
    this.scopeBody = ''
    this.scopedKeyframes = new Map(); // 存储已处理的keyframe映射
  }

  /**
   * 解析CSS文本并添加作用域
   * @param {string} cssText - CSS文本
   * @param {string} scope - 作用域标识符
   * @returns {string} - 处理后的CSS文本
   */
  parse(cssText, scope) {
    this.scopeAttribute = `[vrefof="${scope}"]`;
    this.scopeBody = `[vref="${scope}"]`
    this.scopedKeyframes.clear();
    this.scopeSuffix = scope.replace(/[^a-zA-Z0-9]/g, ''); // 清理作用域后缀

    // 移除注释
    cssText = this.removeComments(cssText);

    // 第一遍：收集所有keyframes名称
    this.collectKeyframes(cssText);

    // 第二遍：解析CSS规则并替换动画名称
    return this.parseRules(cssText);
  }

  /**
   * 收集所有keyframes名称
   * @param {string} cssText 
   */
  collectKeyframes(cssText) {
    const keyframeRegex = /@keyframes\s+([^\s{]+)/gi;
    let match;

    while ((match = keyframeRegex.exec(cssText)) !== null) {
      const originalName = match[1];
      const scopedName = originalName + '-' + this.scopeSuffix;
      this.scopedKeyframes.set(originalName, scopedName);
    }
  }

  /**
   * 移除CSS注释
   * @param {string} cssText 
   * @returns {string}
   */
  removeComments(cssText) {
    return cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  /**
   * 解析CSS规则
   * @param {string} cssText 
   * @returns {string}
   */
  parseRules(cssText) {
    let result = '';
    let i = 0;

    while (i < cssText.length) {
      // 跳过空白字符
      while (i < cssText.length && /\s/.test(cssText[i])) {
        result += cssText[i];
        i++;
      }

      if (i >= cssText.length) break;

      // 检查是否是@规则
      if (cssText[i] === '@') {
        const atRule = this.parseAtRule(cssText, i);
        result += atRule.content;
        i = atRule.endIndex;
      } else {
        // 普通CSS规则
        const rule = this.parseNormalRule(cssText, i);
        result += rule.content;
        i = rule.endIndex;
      }
    }

    return result;
  }

  /**
   * 解析@规则（如@media, @keyframes等）
   * @param {string} cssText 
   * @param {number} startIndex 
   * @returns {object}
   */
  parseAtRule(cssText, startIndex) {
    let i = startIndex;
    let atRuleContent = '';

    // 读取@规则名称和参数
    while (i < cssText.length && cssText[i] !== '{') {
      atRuleContent += cssText[i];
      i++;
    }

    if (i >= cssText.length) {
      return { content: atRuleContent, endIndex: i };
    }

    // 检查是否是@keyframes或@media
    const atRuleName = atRuleContent.toLowerCase().trim();

    if (atRuleName.startsWith('@keyframes')) {
      return this.parseKeyframes(cssText, startIndex);
    } else if (atRuleName.startsWith('@media')) {
      return this.parseMedia(cssText, startIndex);
    } else if (atRuleName.startsWith('@supports')) {
      return this.parseSupports(cssText, startIndex);
    } else {
      // 其他@规则，查找匹配的大括号
      const braceContent = this.findMatchingBrace(cssText, i);
      return {
        content: atRuleContent + braceContent.content,
        endIndex: braceContent.endIndex
      };
    }
  }

  /**
   * 解析@keyframes规则
   * @param {string} cssText 
   * @param {number} startIndex 
   * @returns {object}
   */
  parseKeyframes(cssText, startIndex) {
    let i = startIndex;
    let result = '';

    // 读取@keyframes声明
    while (i < cssText.length && cssText[i] !== '{') {
      result += cssText[i];
      i++;
    }

    if (i >= cssText.length) {
      return { content: result, endIndex: i };
    }

    // 处理keyframes内容
    const braceContent = this.findMatchingBrace(cssText, i);
    const keyframesContent = braceContent.content;

    // 为keyframes名称添加作用域
    const keyframeName = this.extractKeyframeName(result);
    const scopedKeyframeName = this.scopedKeyframes.get(keyframeName);
    if (scopedKeyframeName) {
      result = result.replace(keyframeName, scopedKeyframeName);
    }

    result += keyframesContent;

    return {
      content: result,
      endIndex: braceContent.endIndex
    };
  }

  /**
   * 提取keyframe名称
   * @param {string} keyframeDeclaration 
   * @returns {string}
   */
  extractKeyframeName(keyframeDeclaration) {
    const match = keyframeDeclaration.match(/@keyframes\s+([^\s{]+)/i);
    return match ? match[1] : '';
  }

  /**
   * 解析@media规则
   * @param {string} cssText 
   * @param {number} startIndex 
   * @returns {object}
   */
  parseMedia(cssText, startIndex) {
    let i = startIndex;
    let result = '';

    // 读取@media声明
    while (i < cssText.length && cssText[i] !== '{') {
      result += cssText[i];
      i++;
    }

    if (i >= cssText.length) {
      return { content: result, endIndex: i };
    }

    result += '{';
    i++; // 跳过开始的 '{'

    // 解析@media内部的CSS规则
    let braceLevel = 1;
    let innerCss = '';

    while (i < cssText.length && braceLevel > 0) {
      if (cssText[i] === '{') {
        braceLevel++;
      } else if (cssText[i] === '}') {
        braceLevel--;
        if (braceLevel === 0) {
          break;
        }
      }
      innerCss += cssText[i];
      i++;
    }

    // 递归处理@media内部的CSS规则
    const processedInnerCss = this.parseRules(innerCss);
    result += processedInnerCss;

    if (i < cssText.length && cssText[i] === '}') {
      result += '}';
      i++;
    }

    return {
      content: result,
      endIndex: i
    };
  }

  /**
   * 解析@supports规则
   * @param {string} cssText 
   * @param {number} startIndex 
   * @returns {object}
   */
  parseSupports(cssText, startIndex) {
    return this.parseMedia(cssText, startIndex);
  }

  /**
   * 解析普通CSS规则
   * @param {string} cssText 
   * @param {number} startIndex 
   * @returns {object}
   */
  parseNormalRule(cssText, startIndex) {
    let i = startIndex;
    let selector = '';

    // 读取选择器
    while (i < cssText.length && cssText[i] !== '{') {
      selector += cssText[i];
      i++;
    }

    if (i >= cssText.length) {
      return { content: selector, endIndex: i };
    }

    // 处理选择器添加作用域
    const scopedSelector = this.addScopeToSelector(selector.trim());

    // 读取CSS规则体并处理动画名称
    const braceContent = this.findMatchingBrace(cssText, i);
    const processedContent = this.processRuleContent(braceContent.content);

    return {
      content: scopedSelector + processedContent,
      endIndex: braceContent.endIndex
    };
  }

  /**
   * 处理CSS规则内容，替换动画名称
   * @param {string} content 
   * @returns {string}
   */
  processRuleContent(content) {
    let processedContent = content;

    // 处理 animation 属性
    processedContent = processedContent.replace(
      /animation\s*:\s*([^;]+);/gi,
      (match, animationValue) => {
        const processedValue = this.processAnimationValue(animationValue);
        return `animation: ${processedValue};`;
      }
    );

    // 处理 animation-name 属性
    processedContent = processedContent.replace(
      /animation-name\s*:\s*([^;]+);/gi,
      (match, animationNames) => {
        const processedNames = this.processAnimationNames(animationNames);
        return `animation-name: ${processedNames};`;
      }
    );

    return processedContent;
  }

  /**
   * 处理animation属性值
   * @param {string} animationValue 
   * @returns {string}
   */
  processAnimationValue(animationValue) {
    // animation 可能包含多个动画，用逗号分隔
    const animations = animationValue.split(',').map(anim => anim.trim());

    return animations.map(animation => {
      const parts = animation.split(/\s+/);

      // 第一个非时间、非数字、非关键字的值通常是动画名称
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        // 跳过时间值 (如 0.3s, 200ms)
        if (/^\d+(\.\d+)?(s|ms)$/.test(part)) continue;

        // 跳过数字值 (如 iteration count)
        if (/^\d+(\.\d+)?$/.test(part)) continue;

        // 跳过CSS关键字
        if (['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear', 'infinite',
          'normal', 'reverse', 'alternate', 'alternate-reverse', 'forwards',
          'backwards', 'both', 'running', 'paused'].includes(part)) continue;

        // 跳过贝塞尔曲线
        if (part.startsWith('cubic-bezier(')) continue;

        // 这应该是动画名称
        const scopedName = this.scopedKeyframes.get(part);
        if (scopedName) {
          parts[i] = scopedName;
        }
        break;
      }

      return parts.join(' ');
    }).join(', ');
  }

  /**
   * 处理animation-name属性值
   * @param {string} animationNames 
   * @returns {string}
   */
  processAnimationNames(animationNames) {
    return animationNames.split(',').map(name => {
      const trimmedName = name.trim();
      const scopedName = this.scopedKeyframes.get(trimmedName);
      return scopedName || trimmedName;
    }).join(', ');
  }

  /**
   * 为选择器添加作用域
   * @param {string} selector 
   * @returns {string}
   */
  addScopeToSelector(selector) {
    if (!selector.trim()) return selector;

    // 分割多个选择器（用逗号分隔）
    const selectors = selector.split(',').map(sel => sel.trim());

    const scopedSelectors = selectors.map(sel => {
      return this.addScopeToSingleSelector(sel);
    });

    return scopedSelectors.join(', ');
  }

  /**
   * 为单个选择器添加作用域
   * @param {string} selector 
   * @returns {string}
   */
  addScopeToSingleSelector(selector) {
    if (!selector.trim()) return selector;

    // 处理伪元素选择器 - 在伪元素前添加作用域
    if (selector.includes('::')) {
      const parts = selector.split('::');
      const mainPart = parts[0];
      const pseudoElement = '::' + parts.slice(1).join('::');

      // 为主要部分添加作用域
      const scopedMain = this.addScopeToSelectorPart(mainPart);
      return scopedMain + pseudoElement;
    }

    // 处理伪类选择器 - 在伪类前添加作用域
    if (selector.includes(':') && !selector.includes('::')) {
      const pseudoMatch = selector.match(/^([^:]+)(:.+)$/);
      if (pseudoMatch) {
        const mainPart = pseudoMatch[1];
        const pseudoClass = pseudoMatch[2];

        // 为主要部分添加作用域
        const scopedMain = this.addScopeToSelectorPart(mainPart);
        return scopedMain + pseudoClass;
      }
    }

    // 处理特殊选择器
    if (selector === '*' || selector.startsWith('@')) {
      return selector;
    }

    // 处理复合选择器
    return this.addScopeToSelectorPart(selector);
  }

  /**
   * 为选择器部分添加作用域
   * @param {string} selectorPart 
   * @returns {string}
   */
  addScopeToSelectorPart(selectorPart) {
    // 处理组合器选择器（>、+、~、空格）
    const combinatorRegex = /(\s*[>+~]\s*|\s+)/;

    if (combinatorRegex.test(selectorPart)) {
      // 分割选择器，但保留组合器
      const parts = selectorPart.split(combinatorRegex);
      if (/^body(?:$|[:\[ ])/.test(parts[0])) {
        parts[0] = this.scopeBody + parts[0].slice(4)
        return parts.join('');
      }
      if (/^:root(?:$|[:\[ ])/.test(parts[0])) {
        parts[0] = this.scopeBody + parts[0].slice(5)
        return parts.join('');
      }

      // 只在最后一个选择器部分添加作用域
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].trim() && !combinatorRegex.test(parts[i])) {
          let tag = parts[i].trim()
          if (/^body(?:$|[:\[ ])/.test(tag)) {
            parts[i] = this.scopeBody + tag.slice(4)
          } else if (/^:root(?:$:[$:\[ ])/.test(tag)) {
            parts[i] = this.scopeBody + tag.slice(5)
          } else {
            parts[i] = parts[i].trim() + this.scopeAttribute;
          }
          break;
        }
      }

      return parts.join('');
    }
    selectorPart = selectorPart.trim()
    let tag = selectorPart.trim()
    if (/^body(?:$|[:\[ ])/.test(tag)) {
      return this.scopeBody + tag.slice(4)
    } else if (/^:root(?:$:[$:\[ ])/.test(tag)) {
      return this.scopeBody + tag.slice(5)
    } else {
      return tag + this.scopeAttribute;
    }
  }

  /**
   * 查找匹配的大括号
   * @param {string} cssText 
   * @param {number} startIndex 
   * @returns {object}
   */
  findMatchingBrace(cssText, startIndex) {
    let i = startIndex;
    let content = '';
    let braceLevel = 0;

    while (i < cssText.length) {
      content += cssText[i];

      if (cssText[i] === '{') {
        braceLevel++;
      } else if (cssText[i] === '}') {
        braceLevel--;
        if (braceLevel === 0) {
          i++;
          break;
        }
      }
      i++;
    }

    return {
      content: content,
      endIndex: i
    };
  }
}

// 使用示例
const parser = new CSSParser();

// 示例CSS
const cssText = `
  body{}
  .container::before, .a {
    content: "";
    animation-name: fadeIn, slideUp;
    animation: slideIn 0.5s infinite alternate;
  }
  
  @keyframes slideIn {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(0);
    }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  
  @media (max-width: 768px) {
    .container {
      font-size: 14px;
      animation: slideIn 0.2s ease-out;
    }
    
    .item {
      margin: 5px;
    }
  }
  
  .box > .child {
    color: green;
  }
  
  .box + .sibling {
    margin-top: 20px;
  }
`;

// 解析并添加作用域
// console.log(parser.parse(cssText, 'comasd-123'));

// 导出类
export default parser;

export { CSSParser }
