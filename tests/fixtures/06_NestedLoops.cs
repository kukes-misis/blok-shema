using System;

namespace GostFlowchart.Fixtures
{
    /// <summary>
    /// Fixture 06 - Nested loops.
    /// An inner loop inside an outer loop, with a break out of the inner loop.
    /// Exercises nested loop-back edges and edge crossing in the layout.
    /// </summary>
    public static class NestedLoops
    {
        public static void PrintMultiplicationTable(int size)
        {
            for (int row = 1; row <= size; row++)
            {
                for (int col = 1; col <= size; col++)
                {
                    if (col > row)
                    {
                        break;
                    }

                    Console.Write((row * col).ToString().PadLeft(4));
                }

                Console.WriteLine();
            }
        }

        public static void Run()
        {
            Console.Write("Enter table size: ");
            int size = int.Parse(Console.ReadLine() ?? string.Empty);
            PrintMultiplicationTable(size);
        }
    }
}
