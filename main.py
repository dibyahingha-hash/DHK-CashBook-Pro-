from kivy.app import App
from kivy.core.window import Window
from kivy.metrics import dp
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.scrollview import ScrollView
from kivy.uix.textinput import TextInput

# Optional: set a standard mobile preview window size for desktop testing
Window.size = (400, 680)


class PMPoshanApp(App):

    def build(self):
        self.title = "PM POSHAN Calculator"

        # Main scrollable container
        root_scroll = ScrollView(size_hint=(1, 1), do_scroll_x=False)

        # Form layout
        self.layout = BoxLayout(
            orientation="vertical",
            padding=[dp(16), dp(16), dp(16), dp(16)],
            spacing=dp(10),
            size_hint_y=None,
        )
        self.layout.bind(minimum_height=self.layout.setter("height"))

        # Title
        title_label = Label(
            text="[b]PM POSHAN Monthly Calculator[/b]",
            markup=True,
            font_size="20sp",
            size_hint_y=None,
            height=dp(36),
            color=(0.15, 0.25, 0.45, 1),
        )
        subtitle_label = Label(
            text="Enter meal counts and rates:",
            font_size="13sp",
            size_hint_y=None,
            height=dp(24),
            color=(0.4, 0.4, 0.4, 1),
        )
        self.layout.add_widget(title_label)
        self.layout.add_widget(subtitle_label)

        # Input Helper
        def create_input_field(label_text, default_val):
            lbl = Label(
                text=label_text,
                size_hint_y=None,
                height=dp(24),
                halign="left",
                valign="middle",
                color=(0.1, 0.1, 0.1, 1),
            )
            lbl.bind(size=lbl.setter("text_size"))

            inp = TextInput(
                text=default_val,
                multiline=False,
                size_hint_y=None,
                height=dp(42),
                input_filter="float",
                padding=[dp(10), dp(10), dp(10), dp(10)],
            )
            self.layout.add_widget(lbl)
            self.layout.add_widget(inp)
            return inp

        # Fields
        self.bal_input = create_input_field("Bal Vatika Meals Served:", "0")
        self.pri_input = create_input_field("Primary Meals Served:", "0")
        self.rate_input = create_input_field(
            "Cooking Cost / Meal (Rs.):", "5.45"
        )
        self.grain_input = create_input_field(
            "Food Grain / Meal (kg):", "0.100"
        )

        # Calculate Button
        btn_calc = Button(
            text="CALCULATE",
            size_hint_y=None,
            height=dp(48),
            background_normal="",
            background_color=(0.18, 0.35, 0.60, 1),
            color=(1, 1, 1, 1),
            bold=True,
            font_size="15sp",
        )
        btn_calc.bind(on_release=self.calculate)
        self.layout.add_widget(btn_calc)

        # Output Card / Label
        self.result_label = Label(
            text="Press Calculate to see figures.",
            markup=True,
            font_size="13sp",
            size_hint_y=None,
            halign="left",
            valign="top",
            color=(0.1, 0.1, 0.1, 1),
        )
        self.result_label.bind(
            texture_size=lambda instance, value: setattr(
                instance, "height", value[1] + dp(20)
            )
        )
        self.result_label.bind(
            width=lambda instance, value: setattr(
                instance, "text_size", (value - dp(10), None)
            )
        )

        self.layout.add_widget(self.result_label)

        root_scroll.add_widget(self.layout)
        return root_scroll

    def calculate(self, instance):
        try:
            # Safe parsing
            bal_str = self.bal_input.text.strip()
            pri_str = self.pri_input.text.strip()
            cost_str = self.rate_input.text.strip()
            grain_str = self.grain_input.text.strip()

            bal_meals = int(float(bal_str)) if bal_str else 0
            pri_meals = int(float(pri_str)) if pri_str else 0
            cost_rate = float(cost_str) if cost_str else 5.45
            grain_rate = float(grain_str) if grain_str else 0.100

            if bal_meals < 0 or pri_meals < 0:
                self.result_label.text = (
                    "[color=ff3333][b]Error:[/b] Meal counts cannot be negative.[/color]"
                )
                return

            total_meals = bal_meals + pri_meals

            # Computations
            bal_grain = bal_meals * grain_rate
            pri_grain = pri_meals * grain_rate
            total_grain = total_meals * grain_rate

            bal_cost = bal_meals * cost_rate
            pri_cost = pri_meals * cost_rate
            total_cost = total_meals * cost_rate

            # Output markup
            summary_text = (
                f"[color=203050][b]CALCULATION SUMMARY[/b][/color]\n"
                f"---------------------------------------------------\n"
                f"[b]Total Meals Served:[/b] {total_meals}\n\n"
                f"[b]1. Food Grains Requirement (KG):[/b]\n"
                f"   • Bal Vatika: {bal_grain:.3f} kg\n"
                f"   • Primary: {pri_grain:.3f} kg\n"
                f"   [b]-> Total Grains:[/b] [color=006600][b]{total_grain:.3f} kg[/b][/color]\n\n"
                f"[b]2. Cooking Cost (Rs.):[/b]\n"
                f"   • Bal Vatika: Rs. {bal_cost:.2f}\n"
                f"   • Primary: Rs. {pri_cost:.2f}\n"
                f"   [b]-> Total Cost:[/b] [color=006600][b]Rs. {total_cost:.2f}[/b][/color]\n"
                f"---------------------------------------------------"
            )
            self.result_label.text = summary_text

        except ValueError:
            self.result_label.text = (
                "[color=ff3333][b]Error:[/b] Please enter valid numbers.[/color]"
            )
        except Exception as e:
            self.result_label.text = (
                f"[color=ff3333][b]Unexpected Error:[/b] {str(e)}[/color]"
            )


if __name__ == "__main__":
    PMPoshanApp().run()
