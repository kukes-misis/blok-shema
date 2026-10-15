// static/js/tma.js - Telegram Mini App (TMA) Integration & Motion Design
'use strict';

(function () {
  var tg = window.Telegram ? window.Telegram.WebApp : null;

  var TMA = {
    isInsideTelegram: Boolean(tg && tg.initData),
    webApp: tg,

    // Haptic Feedback with fallback
    haptic: function (type, style) {
      if (!tg || !tg.HapticFeedback) return;
      try {
        if (type === 'impact') {
          tg.HapticFeedback.impactOccurred(style || 'medium');
        } else if (type === 'notification') {
          tg.HapticFeedback.notificationOccurred(style || 'success');
        } else if (type === 'selection') {
          tg.HapticFeedback.selectionChanged();
        }
      } catch (e) {
        // Safe fallback
      }
    },

    // Initialize TMA environment
    init: function () {
      if (!this.isInsideTelegram) {
        return;
      }

      console.log('🚀 Запуск в режиме Telegram Mini App!');
      document.body.classList.add('is-tma');

      // Expand to maximum height
      tg.expand();
      tg.enableClosingConfirmation();
      tg.ready();

      // Synchronize theme with Telegram client
      this.syncTheme();
      tg.onEvent('themeChanged', function () {
        TMA.syncTheme();
      });

      // Synchronize back button on tab changes
      this.setupBackButton();

      // Bind haptic feedback to interactive elements
      this.bindHaptics();

      // Configure Telegram MainButton
      this.setupMainButton();
    },

    // Sync theme colors with Telegram
    syncTheme: function () {
      if (!tg) return;
      var isDark = tg.colorScheme === 'dark';
      if (window.app && typeof window.app.setTheme === 'function') {
        window.app.setTheme(isDark);
      }

      var headerColor = isDark ? '#161b22' : '#f6f8fa';
      var bgColor = isDark ? '#0d1117' : '#ffffff';

      try {
        if (tg.setHeaderColor) tg.setHeaderColor(headerColor);
        if (tg.setBackgroundColor) tg.setBackgroundColor(bgColor);
      } catch (e) {}
    },

    // BackButton navigation inside Telegram
    setupBackButton: function () {
      if (!tg || !tg.BackButton) return;

      var tabs = document.querySelectorAll('.tab[data-tab]');
      tabs.forEach(function (t) {
        t.addEventListener('click', function () {
          var target = t.getAttribute('data-tab');
          if (target !== 'gen') {
            tg.BackButton.show();
          } else {
            tg.BackButton.hide();
          }
        });
      });

      tg.BackButton.onClick(function () {
        var genTab = document.querySelector('.tab[data-tab="gen"]');
        if (genTab) {
          genTab.click();
          TMA.haptic('impact', 'light');
        }
        tg.BackButton.hide();
      });
    },

    // Native Telegram MainButton
    setupMainButton: function () {
      if (!tg || !tg.MainButton) return;

      tg.MainButton.setText('⚡ НАЧЕРТИТЬ ПО ГОСТ');
      tg.MainButton.show();
      tg.MainButton.onClick(function () {
        TMA.haptic('impact', 'heavy');
        var btnBuild = document.getElementById('btnBuild');
        if (btnBuild) {
          btnBuild.click();
        }
      });
    },

    // Add haptic feedback to buttons and actions
    bindHaptics: function () {
      document.addEventListener('click', function (e) {
        var target = e.target.closest('button, .tab, .ex-card, .tool-btn, .leg-card');
        if (!target) return;

        if (target.id === 'btnBuild') {
          TMA.haptic('impact', 'heavy');
        } else if (target.classList.contains('tab')) {
          TMA.haptic('selection');
        } else if (target.id === 'btnThemeToggle') {
          TMA.haptic('impact', 'light');
        } else {
          TMA.haptic('impact', 'light');
        }
      }, true);
    }
  };

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { TMA.init(); });
  } else {
    TMA.init();
  }

  window.TMA = TMA;
})();
