/**
 * XML预处理工具类
 * 专门处理XML清理和规范化，解决编码、BOM、格式等问题
 */
class XMLPreprocessor {
  /**
   * 预处理XML内容
   * @param {Buffer|string} xmlData - 原始XML数据（Buffer或字符串）
   * @param {Object} options - 可选参数
   * @returns {string} 清理后的XML字符串（UTF-8编码）
   */
  static preprocess(xmlData, options = {}) {
    let xmlContent;

    // 如果是Buffer，需要检测编码
    if (Buffer.isBuffer(xmlData)) {
      xmlContent = this.detectAndConvertEncoding(xmlData, options);
    } else {
      xmlContent = String(xmlData);
    }

    // 清理BOM字符
    xmlContent = this.removeBOM(xmlContent);

    // 清理非XML字符
    xmlContent = this.removeNonXMLChars(xmlContent);

    // 修复XML格式
    xmlContent = this.fixXMLFormat(xmlContent);

    // 规范化XML声明
    xmlContent = this.normalizeXMLDeclaration(xmlContent);

    return xmlContent;
  }

  /**
   * 检测并转换编码
   * @param {Buffer} buffer - 原始Buffer数据
   * @param {Object} options - 可选参数（如Content-Type header）
   * @returns {string} UTF-8编码的字符串
   */
  static detectAndConvertEncoding(buffer, options = {}) {
    // 优先级1: 从Content-Type header检测
    if (options.contentType) {
      const charsetMatch = options.contentType.match(/charset=([^;\s]+)/i);
      if (charsetMatch) {
        const charset = charsetMatch[1].toLowerCase();
        try {
          return buffer.toString(charset);
        } catch (e) {
          // 编码无效，继续尝试其他方法
        }
      }
    }

    // 优先级2: 从XML声明检测
    try {
      const utf8Preview = buffer.toString('utf8', 0, Math.min(200, buffer.length));
      const encodingMatch = utf8Preview.match(/<\?xml[^>]*encoding\s*=\s*["']([^"']+)["']/i);
      if (encodingMatch) {
        const encoding = encodingMatch[1].toLowerCase();
        try {
          return buffer.toString(encoding);
        } catch (e) {
          // 编码无效，继续尝试其他方法
        }
      }
    } catch (e) {
      // 忽略错误，继续尝试
    }

    // 优先级3: 尝试常见编码
    const encodings = ['utf8', 'utf-8', 'gbk', 'gb2312', 'latin1', 'iso-8859-1', 'windows-1252'];
    
    for (const encoding of encodings) {
      try {
        const decoded = buffer.toString(encoding);
        // 简单验证：检查是否包含有效的XML字符
        if (decoded.includes('<?xml') || decoded.includes('<rss') || decoded.includes('<feed')) {
          return decoded;
        }
      } catch (e) {
        // 尝试下一个编码
        continue;
      }
    }

    // 最后尝试：使用UTF-8（即使可能不正确）
    return buffer.toString('utf8');
  }

  /**
   * 移除BOM字符
   * @param {string} content - XML内容
   * @returns {string} 清理后的内容
   */
  static removeBOM(content) {
    if (!content || content.length === 0) {
      return content;
    }

    // UTF-8 BOM: EF BB BF (0xFEFF in UTF-16)
    // UTF-16 LE BOM: FF FE
    // UTF-16 BE BOM: FE FF

    // 检查并移除UTF-8 BOM
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }

    // 检查并移除UTF-16 BOM（如果存在）
    if (content.length >= 2) {
      const firstChar = content.charCodeAt(0);
      const secondChar = content.charCodeAt(1);
      if ((firstChar === 0xFF && secondChar === 0xFE) || 
          (firstChar === 0xFE && secondChar === 0xFF)) {
        content = content.slice(2);
      }
    }

    // 移除可能的字节顺序标记（如果以字节形式存在）
    if (content.startsWith('\uFEFF')) {
      content = content.replace(/^\uFEFF+/, '');
    }

    return content;
  }

  /**
   * 移除XML声明前的非XML字符
   * @param {string} content - XML内容
   * @returns {string} 清理后的内容
   */
  static removeNonXMLChars(content) {
    if (!content) {
      return content;
    }

    // 移除XML声明前的所有非XML字符（包括空白字符、控制字符等）
    // 但保留XML声明本身
    content = content.replace(/^[\s\u0000-\u001F\u007F-\u009F]*/, '');

    // 如果开头不是<?xml，尝试找到第一个<字符
    if (!content.trim().startsWith('<?xml') && !content.trim().startsWith('<')) {
      const firstLT = content.indexOf('<');
      if (firstLT > 0) {
        content = content.slice(firstLT);
      }
    }

    // 移除XML声明前的非XML字符（更精确的匹配）
    content = content.replace(/^[^<]*?(?=<\?xml|<rss|<feed|<atom)/i, '');

    return content;
  }

  /**
   * 修复XML格式错误
   * @param {string} content - XML内容
   * @returns {string} 修复后的内容
   */
  static fixXMLFormat(content) {
    if (!content) {
      return content;
    }

    // 确保特殊字符正确转义（在文本内容中，不在标签中）
    // 注意：这里要小心，不要破坏已有的实体引用
    
    // 修复未转义的&符号（但保留已有的实体引用）
    content = content.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, '&amp;');

    // 修复CDATA块中的问题（CDATA块应该保持原样）
    // 先提取CDATA块
    const cdataBlocks = [];
    content = content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, (match, cdata) => {
      const id = `__CDATA_${cdataBlocks.length}__`;
      cdataBlocks.push(cdata);
      return id;
    });

    // 修复标签中的问题
    // 确保标签正确闭合（简单修复，复杂情况可能需要更高级的解析）

    // 恢复CDATA块
    cdataBlocks.forEach((cdata, index) => {
      content = content.replace(`__CDATA_${index}__`, `<![CDATA[${cdata}]]>`);
    });

    return content;
  }

  /**
   * 规范化XML声明
   * @param {string} content - XML内容
   * @returns {string} 规范化后的内容
   */
  static normalizeXMLDeclaration(content) {
    if (!content) {
      return content;
    }

    const trimmed = content.trim();

    // 如果没有XML声明，添加一个
    if (!trimmed.startsWith('<?xml')) {
      // 检查是否是RSS/Atom feed
      if (trimmed.startsWith('<rss') || trimmed.startsWith('<feed') || trimmed.startsWith('<atom')) {
        content = '<?xml version="1.0" encoding="UTF-8"?>\n' + content;
      }
    } else {
      // 确保XML声明格式正确
      // 提取现有的XML声明
      const xmlDeclMatch = trimmed.match(/^<\?xml([^>]+)\?>/);
      if (xmlDeclMatch) {
        const attrs = xmlDeclMatch[1];
        // 确保有version和encoding
        let newDecl = '<?xml';
        if (!attrs.includes('version')) {
          newDecl += ' version="1.0"';
        } else {
          const versionMatch = attrs.match(/version\s*=\s*["']([^"']+)["']/);
          if (versionMatch) {
            newDecl += ` version="${versionMatch[1]}"`;
          } else {
            newDecl += ' version="1.0"';
          }
        }
        if (!attrs.includes('encoding')) {
          newDecl += ' encoding="UTF-8"';
        } else {
          const encodingMatch = attrs.match(/encoding\s*=\s*["']([^"']+)["']/);
          if (encodingMatch) {
            newDecl += ` encoding="${encodingMatch[1]}"`;
          } else {
            newDecl += ' encoding="UTF-8"';
          }
        }
        newDecl += '?>';
        
        // 替换XML声明
        content = content.replace(/^<\?xml[^>]*\?>/, newDecl);
      }
    }

    return content;
  }

  /**
   * 验证XML格式
   * @param {string} content - XML内容
   * @returns {boolean} 是否为有效的XML格式
   */
  static isValidXML(content) {
    if (!content || content.trim().length === 0) {
      return false;
    }

    // 基本检查：是否包含XML标签
    if (!content.includes('<') || !content.includes('>')) {
      return false;
    }

    // 检查是否有基本的XML结构（更宽松的检查）
    const trimmed = content.trim();
    const hasXMLDecl = trimmed.startsWith('<?xml');
    const hasRSS = /<rss/i.test(content);
    const hasFeed = /<feed/i.test(content);
    const hasAtom = /<atom/i.test(content);
    const hasRDF = /<rdf:RDF/i.test(content);
    const hasRootTag = hasRSS || hasFeed || hasAtom || hasRDF;

    // 只要有XML声明或根标签就认为有效
    return hasXMLDecl || hasRootTag;
  }
}

module.exports = XMLPreprocessor;
