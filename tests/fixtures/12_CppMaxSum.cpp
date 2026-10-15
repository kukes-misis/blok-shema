#include <iostream>
using namespace std;

int main()
{
    double a, b, c;
    cin >> a >> b >> c;

    double max_val;
    if (a >= b && a >= c) {
        max_val = a;
    } else if (b >= c) {
        max_val = b;
    } else {
        max_val = c;
    }

    int sum = 0;
    for (int i = 1; i <= 10; i++) {
        sum += i;
    }

    cout << "Max: " << max_val << endl;
    cout << "Sum: " << sum << endl;
    return 0;
}
