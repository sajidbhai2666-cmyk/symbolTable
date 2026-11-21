/**
 * Compiler Memory Layout & Internal Hash Table Simulator
 * Computes sizeof, memory alignment, stack frame offsets, and bucket hashing.
 */

const BASE_TYPE_SIZES = {
  'void': 0,
  'char': 1,
  'signed char': 1,
  'unsigned char': 1,
  'bool': 1,
  'boolean': 1,
  'int8_t': 1,
  'uint8_t': 1,
  'byte': 1,
  'short': 2,
  'unsigned short': 2,
  'int16_t': 2,
  'uint16_t': 2,
  'int': 4,
  'unsigned int': 4,
  'signed': 4,
  'unsigned': 4,
  'float': 4,
  'int32_t': 4,
  'uint32_t': 4,
  'long': 8, // 64-bit LP64 target
  'unsigned long': 8,
  'long long': 8,
  'unsigned long long': 8,
  'double': 8,
  'int64_t': 8,
  'uint64_t': 8,
  'size_t': 8,
  'pointer': 8, // 64-bit pointers
  'auto': 4,
  'number': 8,
  'string': 16 // string object descriptor
};

/**
 * Calculates byte size of a type description
 */
function calculateTypeSize(typeName, structDefinitions = {}) {
  if (!typeName) return 4;
  const clean = typeName.trim();

  // Pointer types (ends with *) are always pointer size (8 bytes on 64-bit)
  if (clean.endsWith('*') || clean.includes('*')) {
    return 8;
  }

  // Array types: e.g. int[10] or int arr[10]
  const arrayMatch = clean.match(/^(.*?)\[(\d+)\]$/);
  if (arrayMatch) {
    const elemType = arrayMatch[1].trim();
    const count = parseInt(arrayMatch[2], 10);
    const elemSize = calculateTypeSize(elemType, structDefinitions);
    return elemSize * count;
  }

  // Custom Struct / Class
  if (structDefinitions[clean]) {
    return structDefinitions[clean].totalSize || 16;
  }

  // Base types
  const lower = clean.toLowerCase();
  for (const [key, size] of Object.entries(BASE_TYPE_SIZES)) {
    if (lower === key || lower.startsWith(key + ' ') || lower.endsWith(' ' + key)) {
      return size;
    }
  }

  // Default fallback for unknown complex type
  return 4;
}

/**
 * Computes memory offset and layout for a collection of symbols across scopes
 */
function assignMemoryLayout(symbols, scopes) {
  let globalDataOffset = 0;
  const functionStackFrames = new Map(); // scopeId -> current local offset
  const paramRegisters = ['RDI', 'RSI', 'RDX', 'RCX', 'R8', 'R9'];

  for (const sym of symbols) {
    sym.size = calculateTypeSize(sym.type);

    // Global symbols
    if (sym.scopeLevel === 0) {
      if (sym.kind === 'function') {
        sym.offset = 'TEXT_SEGMENT (Function Entry)';
        sym.offsetBytes = 0;
      } else if (sym.kind === 'class' || sym.kind === 'struct' || sym.kind === 'typedef') {
        sym.offset = 'TYPE_DEF';
        sym.offsetBytes = 0;
      } else {
        sym.offset = `+0x${globalDataOffset.toString(16).padStart(4, '0').toUpperCase()} (.data/.bss)`;
        sym.offsetBytes = globalDataOffset;
        globalDataOffset += Math.max(sym.size, 4); // align to at least 4 bytes
      }
      continue;
    }

    // Struct / Class Member Fields
    if (sym.scopeName && (sym.scopeName.startsWith('struct:') || sym.scopeName.startsWith('class:'))) {
      const scopeKey = sym.scopeId;
      let currentOffset = functionStackFrames.get(scopeKey) || 0;
      sym.offset = `Member: +0x${currentOffset.toString(16).padStart(4, '0').toUpperCase()}`;
      sym.offsetBytes = currentOffset;
      currentOffset += sym.size;
      functionStackFrames.set(scopeKey, currentOffset);
      continue;
    }

    // Parameters
    if (sym.kind === 'parameter') {
      const scopeKey = sym.scopeId;
      if (!functionStackFrames.has(scopeKey + '_param_idx')) {
        functionStackFrames.set(scopeKey + '_param_idx', 0);
      }
      const paramIdx = functionStackFrames.get(scopeKey + '_param_idx');
      if (paramIdx < paramRegisters.length) {
        sym.offset = `Reg: %${paramRegisters[paramIdx]} (Param #${paramIdx + 1})`;
        sym.offsetBytes = paramIdx;
      } else {
        const stackOffset = 16 + (paramIdx - paramRegisters.length) * 8;
        sym.offset = `[rbp + ${stackOffset}]`;
        sym.offsetBytes = stackOffset;
      }
      functionStackFrames.set(scopeKey + '_param_idx', paramIdx + 1);
      continue;
    }

    // Local variables in function or block scopes
    if (sym.kind === 'variable' || sym.kind === 'constant') {
      // Find enclosing function scope or current scope
      const scopeKey = sym.scopeId;
      let currentOffset = functionStackFrames.get(scopeKey) || 0;
      currentOffset += Math.max(sym.size, 4); // align stack allocation
      functionStackFrames.set(scopeKey, currentOffset);

      sym.offset = `[rbp - ${currentOffset}]`;
      sym.offsetBytes = -currentOffset;
      continue;
    }

    sym.offset = 'N/A';
    sym.offsetBytes = null;
  }

  return symbols;
}

/**
 * Simulates compiler internal Hash Table with chaining
 * TABLE_SIZE: default 16 buckets
 */
function buildCompilerHashTable(symbols, tableSize = 16) {
  const buckets = Array.from({ length: tableSize }, (_, i) => ({
    bucketIndex: i,
    entries: []
  }));

  for (const sym of symbols) {
    // Polynomial rolling hash
    let hash = 0;
    const name = sym.name;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    }
    const bucketIndex = hash % tableSize;

    buckets[bucketIndex].entries.push({
      symbolName: sym.name,
      kind: sym.kind,
      type: sym.type,
      scopeName: sym.scopeName,
      line: sym.line,
      col: sym.col,
      hashCode: `0x${hash.toString(16).toUpperCase()}`
    });
  }

  return buckets;
}

module.exports = {
  calculateTypeSize,
  assignMemoryLayout,
  buildCompilerHashTable
};
