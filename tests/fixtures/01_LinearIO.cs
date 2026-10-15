using System;

namespace GostFlowchart.Fixtures
{
    /// <summary>
    /// Fixture 01 - Linear I/O.
    /// Straight-line control flow: read input, compute, write output.
    /// No branching, no loops. The flow graph should be a single path.
    /// </summary>
    public static class LinearIO
    {
        public static void Run()
        {
            Console.Write("Enter a: ");
            double a = double.Parse(Console.ReadLine() ?? string.Empty);

            Console.Write("Enter b: ");
            double b = double.Parse(Console.ReadLine() ?? string.Empty);

            double sum = a + b;
            double product = a * b;
            double mean = sum / 2.0;

            Console.WriteLine("a + b = " + sum);
            Console.WriteLine("a * b = " + product);
            Console.WriteLine("mean  = " + mean);
        }
    }
}
