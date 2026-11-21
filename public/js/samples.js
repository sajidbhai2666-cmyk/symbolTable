/**
 * Preset Code Samples for Symbol Table Demonstration
 */

const CODE_SAMPLES = {
  c_comprehensive: {
    title: 'C: Comprehensive Compiler Test',
    language: 'c',
    code: `/* Comprehensive Symbol Table Test in C
 * Demonstrates: Globals, Structs, Typedefs, Functions, 
 * Parameters, Lexical Scoping, Shadowing, and Memory Offsets.
 */

#include <stdio.h>

// Global Declarations (Data Segment)
int globalCounter = 0;
const double PI = 3.1415926535;
char systemFlag = 'A';

// User-defined Struct (Composite Type)
struct Point {
    int x;
    int y;
    float weight;
};

typedef struct Point Point2D;

// Function Declaration with Parameters
double calculateDistance(Point2D p1, Point2D p2) {
    // Local Variables (Stack Frame)
    double deltaX = p2.x - p1.x;
    double deltaY = p2.y - p1.y;
    double result = 0.0;
    
    // Nested Block Scope
    {
        int factorX = 10;
        int tempMultiplier = 2;
        result = (factorX * tempMultiplier) + deltaY;
    }
    
    // For-loop Block Scope
    for (int step = 0; step < 5; step++) {
        int loopLocal = step * 2;
        result += loopLocal;
    }
    
    return result + deltaX;
}

int main() {
    Point2D pointA;
    Point2D pointB;
    int status = 0;
    
    pointA.x = 10;
    pointA.y = 20;
    pointB.x = 40;
    pointB.y = 60;
    
    double dist = calculateDistance(pointA, pointB);
    if (systemFlag == 'A') {
        globalCounter += (int)(dist + PI);
    }
    
    return status;
}
`
  },

  scoping_shadowing: {
    title: 'Lexical Scoping & Variable Shadowing',
    language: 'c',
    code: `/* Lexical Scoping & Variable Shadowing Demo
 * Notice how identifier 'x' is declared at multiple scope depths!
 */

int x = 1000; // Level 0: Global Scope
int y = 500;

void scopeDemo() {
    int x = 100; // Level 1: Function Scope (shadows Global x)
    int a = 10;
    
    {
        int x = 10; // Level 2: Block Scope (shadows Function x)
        int b = 20;
        
        {
            int x = 1; // Level 3: Deeply Nested Block (shadows Block x)
            int c = 30;
            y = x + a + b + c;
        }
        
        int afterNested = x + b;
    }
    
    int finalVal = x + a;
}
`
  },

  cpp_oop: {
    title: 'C++: Object-Oriented Class & Methods',
    language: 'cpp',
    code: `// C++ Class, Methods, Fields, and Inheritance
#include <iostream>

class Vehicle {
public:
    int speed;
    int capacity;
    
    void accelerate(int amount) {
        speed += amount;
    }
};

class ElectricCar : public Vehicle {
private:
    int batteryLevel;
    const int maxVoltage = 400;

public:
    int charge(int boost) {
        int newLevel = batteryLevel + boost;
        if (newLevel > 100) {
            newLevel = 100;
        }
        batteryLevel = newLevel;
        return batteryLevel;
    }
};
`
  },

  pointers_arrays: {
    title: 'Pointers, Arrays & Memory Sizing',
    language: 'c',
    code: `// Pointers, Arrays, and Memory Offsets
#include <stdlib.h>

int globalBuffer[128]; // Large array in BSS segment
char* globalStringPtr;

void processMemory(int* bufferPtr, int count) {
    int localIndex = 0;
    char byteFlags[16];
    double accumulator = 0.0;
    
    for (int i = 0; i < count; i++) {
        bufferPtr[i] = i * 2;
        accumulator += bufferPtr[i];
    }
}
`
  },

  python_scoping: {
    title: 'Python: Scopes & Functions',
    language: 'python',
    code: `# Python Scoping & Symbol Table
global_app_name = "Symbol Analyzer"
MAX_RETRIES = 5

class CompilerService:
    def __init__(self, mode, debug):
        self.mode = mode
        self.debug = debug

    def execute_pass(self, source_code, options):
        pass_count = 0
        status = "ready"
        
        for index in range(MAX_RETRIES):
            iteration_var = index * 2
            pass_count += 1
            
        return pass_count
`
  },

  semantic_errors: {
    title: 'Semantic Errors Showcase (Redeclaration & Undeclared)',
    language: 'c',
    code: `/* Semantic Errors & Compiler Diagnostics Test
 * This code intentionally contains common compiler errors
 * to test the symbol table's semantic verification engine!
 */

int totalCount = 10;
int totalCount = 20; // ERROR 1: Duplicate declaration in Global Scope!

void compute() {
    int localVal = 5;
    int localVal = 15; // ERROR 2: Duplicate declaration in same scope!
    
    // ERROR 3: Use of undeclared variable 'missingVariable'!
    missingVariable = localVal + 10;
    
    // ERROR 4: Call to undeclared function!
    undefinedFunction(42);
}
`
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CODE_SAMPLES };
}
