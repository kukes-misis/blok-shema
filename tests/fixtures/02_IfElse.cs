using System;

namespace GostFlowchart.Fixtures
{
    /// <summary>
    /// Fixture 02 - If / Else if / Else ladder.
    /// A single decision node with three mutually exclusive exits
    /// plus a fallthrough else. Exercises decision-diamond rendering.
    /// </summary>
    public static class IfElse
    {
        public static string Classify(int score)
        {
            if (score < 0 || score > 100)
            {
                return "invalid";
            }
            else if (score >= 90)
            {
                return "excellent";
            }
            else if (score >= 75)
            {
                return "good";
            }
            else if (score >= 60)
            {
                return "pass";
            }
            else
            {
                return "fail";
            }
        }

        public static void Run()
        {
            Console.Write("Enter score: ");
            int score = int.Parse(Console.ReadLine() ?? string.Empty);
            Console.WriteLine("Result: " + Classify(score));
        }
    }
}
